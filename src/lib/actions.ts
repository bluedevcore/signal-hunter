"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema, migrateDb } from "@/db";
import { STAGES, type Stage } from "@/db/schema";
import { seed } from "./seed";
import { COOKIE, makeSession } from "./auth";
import { askClaude } from "./claude";

const { leads, activities, diagnoses, demos, jobs, companies, contacts } = schema;

export async function login(formData: FormData) {
  const pw = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");
  if (!process.env.APP_PASSWORD || pw !== process.env.APP_PASSWORD) redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  (await cookies()).set(COOKIE, await makeSession(), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(next.startsWith("/") ? next : "/");
}

export async function setupDatabase(formData: FormData) {
  const reset = formData.get("reset") === "on";
  await migrateDb();
  const msg = await seed({ reset });
  revalidatePath("/", "layout");
  redirect(`/setup?done=${encodeURIComponent(msg)}`);
}

export async function setStage(leadId: number, stage: string) {
  if (!STAGES.includes(stage as Stage)) return;
  const db = await getDb();
  const [cur] = await db.select({ stage: leads.stage }).from(leads).where(eq(leads.id, leadId));
  if (!cur || cur.stage === stage) return;
  await db.update(leads).set({ stage: stage as Stage, stageChangedAt: new Date() }).where(eq(leads.id, leadId));
  await db.insert(activities).values({ leadId, type: "system", body: `Stage: ${cur.stage} → ${stage}` });
  revalidatePath("/", "layout");
}

export async function setStageForm(formData: FormData) {
  await setStage(Number(formData.get("leadId")), String(formData.get("stage")));
}

export async function logActivity(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  const type = String(formData.get("type") || "call");
  const outcome = String(formData.get("outcome") || "") || null;
  const body = String(formData.get("body") || "").trim() || null;
  const nextAction = String(formData.get("nextAction") || "").trim();
  const nextActionAt = String(formData.get("nextActionAt") || "").trim();
  const db = await getDb();
  if (outcome || body) await db.insert(activities).values({ leadId, type, outcome, body });
  if (nextAction || nextActionAt) {
    await db.update(leads).set({ nextAction: nextAction || null, nextActionAt: nextActionAt || null }).where(eq(leads.id, leadId));
  }
  // A real conversation on a New/Researched lead moves it forward.
  if (outcome && ["spoke", "interested", "meeting_booked", "gatekeeper", "voicemail", "no_answer"].includes(outcome)) {
    const [cur] = await db.select({ stage: leads.stage }).from(leads).where(eq(leads.id, leadId));
    const target = outcome === "interested" || outcome === "meeting_booked" ? "Conversation" : "Contacted";
    const order = STAGES.indexOf(cur.stage as Stage);
    if (order < STAGES.indexOf(target as Stage)) await setStage(leadId, target);
  }
  revalidatePath("/", "layout");
  const goto = String(formData.get("redirect") || "");
  if (goto) redirect(goto);
}

export async function updateDemo(formData: FormData) {
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.update(demos).set({
    status: String(formData.get("status") || "queued"),
    liveUrl: String(formData.get("liveUrl") || "").trim() || null,
    loomUrl: String(formData.get("loomUrl") || "").trim() || null,
    updatedAt: new Date(),
  }).where(eq(demos.id, id));
  revalidatePath("/builds");
}

async function leadContext(leadId: number) {
  const db = await getDb();
  const [r] = await db.select({ job: jobs, company: companies, dx: diagnoses }).from(leads)
    .innerJoin(jobs, eq(leads.jobId, jobs.id)).innerJoin(companies, eq(leads.companyId, companies.id))
    .leftJoin(diagnoses, eq(diagnoses.jobId, jobs.id)).where(eq(leads.id, leadId));
  const people = await db.select().from(contacts).where(eq(contacts.companyId, r.company.id));
  return { ...r, people };
}

export async function generateCallScript(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  const c = await leadContext(leadId);
  const text = await askClaude(
    `Write a 60-second cold-call script for me (Josh Bluemink, I build AI tools for small UK businesses). I'm calling ${c.company.name} because they advertised a ${c.job.title} role.
Why they're hiring: ${c.dx?.problem ?? "unknown"}
What my tool does: ${c.dx?.solution ?? "unknown"}
Duties in the ad: ${(c.job.responsibilities || []).join("; ")}
People: ${c.people.map((p) => `${p.name} (${p.title ?? ""})`).join(", ") || "unknown"}
Format: an opener line, 3 short beats (problem, what I built, ask for 15 minutes to show a demo), and 3 likely objections with one-line answers. Plain British English. I'm offering a service at a fraction of the salary, not applying for the job.`,
  );
  const db = await getDb();
  await db.update(diagnoses).set({ callScript: text }).where(eq(diagnoses.jobId, c.job.id));
  revalidatePath(`/leads/${leadId}`);
}

export async function generateBuildBrief(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  const c = await leadContext(leadId);
  const cov = (c.dx?.dutyCoverage || []).map((d) => `- [${d.coverage}] ${d.duty} (${d.how})`).join("\n");
  const text = await askClaude(
    `Write a ready-to-paste Claude Code prompt that builds a client demo.
Client: ${c.company.name}. Role they are hiring: ${c.job.title} (${c.job.salaryText ?? ""}).
Why they're hiring: ${c.dx?.problem ?? ""}
Proposed tool: ${c.dx?.solution ?? ""}
Duties from the ad${cov ? " with coverage" : ""}:
${cov || (c.job.responsibilities || []).map((d) => "- " + d).join("\n")}
The prompt must ask for: realistic synthetic sample data for their industry (no real personal data, no client logos); a Python + Streamlit app using the anthropic SDK (model from CLAUDE_MODEL, key from ANTHROPIC_API_KEY) with a "Run demo with sample data" button and file upload; deterministic Python for maths and matching, Claude only for reading documents and writing text; outputs matching the duties marked full or partial; a "needs human check" list; download buttons; tests for the deterministic parts; DEMO_SCRIPT.md (60-second Loom), PITCH_MESSAGE.md (pitched as a service from Josh Bluemink, never a job application), NEXT_STEPS.md. Output only the prompt.`,
  );
  const db = await getDb();
  await db.update(diagnoses).set({ buildBrief: text }).where(eq(diagnoses.jobId, c.job.id));
  const [d] = await db.select().from(demos).where(eq(demos.leadId, leadId));
  if (d) await db.update(demos).set({ buildBrief: text, updatedAt: new Date() }).where(eq(demos.id, d.id));
  else await db.insert(demos).values({ leadId, status: "queued", buildBrief: text });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/builds");
}

export async function startHuntAction() {
  const { startHunt } = await import("./hunt/engine");
  await startHunt("manual");
  revalidatePath("/hunts");
  redirect("/hunts");
}

export async function startBackfillAction() {
  const { startBackfill } = await import("./hunt/engine");
  await startBackfill(true);
  revalidatePath("/hunts");
  redirect("/hunts");
}

export async function stopRunAction(formData: FormData) {
  const db = await getDb();
  await db.update(schema.runs).set({ status: "failed", error: "Stopped by you", finishedAt: new Date(), lockedUntil: null }).where(eq(schema.runs.id, Number(formData.get("runId"))));
  revalidatePath("/hunts");
}
