import { eq, sql, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { today } from "./util";

const { leads, jobs, companies, diagnoses, contacts, activities, tools, demos, runs } = schema;

export type LeadRow = Awaited<ReturnType<typeof allLeads>>[number];

export async function dbReady(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.select({ n: sql<number>`1` }).from(leads).limit(1);
    return true;
  } catch (e) {
    console.error("dbReady:", e instanceof Error ? `${e.message} ${(e as Error & { cause?: Error }).cause?.message ?? ""}` : e);
    return false;
  }
}

export async function allLeads() {
  const db = await getDb();
  const rows = await db
    .select({
      id: leads.id, stage: leads.stage, score: leads.score, nextAction: leads.nextAction, nextActionAt: leads.nextActionAt,
      jobId: jobs.id, role: jobs.title, location: jobs.location, salaryText: jobs.salaryText, salaryMax: jobs.salaryMax,
      closesAt: jobs.closesAt, url: jobs.url, responsibilities: jobs.responsibilities,
      companyId: companies.id, company: companies.name, size: companies.sizeBand, mainPhone: companies.mainPhone,
      deskFit: diagnoses.deskFit, ease: diagnoses.easeOfBuild, replace: diagnoses.replaceScore, improve: diagnoses.improveScore,
      problem: diagnoses.problem, solution: diagnoses.solution,
    })
    .from(leads)
    .innerJoin(jobs, eq(leads.jobId, jobs.id))
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .leftJoin(diagnoses, eq(diagnoses.jobId, jobs.id))
    .where(eq(leads.archived, false));
  const phones = await db.select({ companyId: contacts.companyId, phone: contacts.phone }).from(contacts);
  const withPhone = new Set(phones.filter((p) => p.phone).map((p) => p.companyId));
  const dem = await db.select({ leadId: demos.leadId, tool: tools.name, status: demos.status }).from(demos).leftJoin(tools, eq(demos.toolId, tools.id));
  const demoBy = new Map(dem.map((d) => [d.leadId, d]));
  return rows.map((r) => ({ ...r, hasPhone: !!r.mainPhone || withPhone.has(r.companyId), demo: demoBy.get(r.id) || null }));
}

export async function diagnosedCount() {
  const db = await getDb();
  const [a] = await db.select({ n: sql<number>`count(*)::int` }).from(diagnoses);
  return a.n;
}

export async function sidebarCounts() {
  const db = await getDb();
  const t = today();
  const [a] = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.archived, false));
  const [b] = await db.select({ n: sql<number>`count(*)::int` }).from(leads)
    .where(sql`${leads.archived} = false and ${leads.nextActionAt} is not null and ${leads.nextActionAt} <= ${t}`);
  return { leads: a.n, today: b.n };
}

export async function leadDetail(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ lead: leads, job: jobs, company: companies, dx: diagnoses })
    .from(leads)
    .innerJoin(jobs, eq(leads.jobId, jobs.id))
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .leftJoin(diagnoses, eq(diagnoses.jobId, jobs.id))
    .where(eq(leads.id, id));
  if (!row) return null;
  const people = await db.select().from(contacts).where(eq(contacts.companyId, row.company.id));
  const timeline = await db.select().from(activities).where(eq(activities.leadId, id)).orderBy(desc(activities.createdAt));
  const siblings = await db
    .select({ id: leads.id, stage: leads.stage, role: jobs.title, salaryText: jobs.salaryText, ease: diagnoses.easeOfBuild, replace: diagnoses.replaceScore, improve: diagnoses.improveScore, problem: diagnoses.problem })
    .from(leads).innerJoin(jobs, eq(leads.jobId, jobs.id)).leftJoin(diagnoses, eq(diagnoses.jobId, jobs.id))
    .where(sql`${leads.companyId} = ${row.company.id} and ${leads.id} <> ${id}`);
  const [demo] = await db.select({ status: demos.status, tool: tools.name, liveUrl: demos.liveUrl }).from(demos).leftJoin(tools, eq(demos.toolId, tools.id)).where(eq(demos.leadId, id));
  return { ...row, people, timeline, siblings, demo: demo || null };
}

export async function buildsData() {
  const db = await getDb();
  const ts = await db.select().from(tools).orderBy(tools.id);
  const ds = await db
    .select({ demo: demos, tool: tools.name, leadId: leads.id, role: jobs.title, company: companies.name, brief: diagnoses.buildBrief })
    .from(demos)
    .innerJoin(leads, eq(demos.leadId, leads.id))
    .innerJoin(jobs, eq(leads.jobId, jobs.id))
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .leftJoin(tools, eq(demos.toolId, tools.id))
    .leftJoin(diagnoses, eq(diagnoses.jobId, jobs.id))
    .orderBy(demos.id);
  const clients = new Map<string, string[]>();
  for (const d of ds) if (d.tool) clients.set(d.tool, [...(clients.get(d.tool) || []), d.company]);
  return { tools: ts.map((t) => ({ ...t, clients: clients.get(t.name) || [] })), demos: ds };
}

export async function runsData() {
  const db = await getDb();
  return db.select().from(runs).orderBy(desc(runs.startedAt));
}

export async function callQueue() {
  const all = await allLeads();
  const t = today();
  const due = all.filter((l) => l.nextActionAt && l.nextActionAt <= t);
  const later = all.filter((l) => l.stage === "Researched" && !(l.nextActionAt && l.nextActionAt <= t));
  const q = [...due.sort((a, b) => (a.nextActionAt! < b.nextActionAt! ? -1 : 1)), ...later.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))];
  const db = await getDb();
  const ids = q.map((l) => l.companyId);
  const people = ids.length ? await db.select().from(contacts).where(inArray(contacts.companyId, ids)) : [];
  return { queue: q, dueCount: due.length, people };
}
