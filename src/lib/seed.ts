import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normaliseName, reedIdFromUrl, ukDate } from "./util";

const { companies, jobs, diagnoses, leads, contacts, activities, tools, demos, runs } = schema;

type JobRow = {
  company: string; role: string; location: string; salary: string; closes: string; size_guess: string;
  desk_fit: string; ease_of_build_1to5: string; replace_score: string; improve_score: string; problem: string;
  evidence_from_ad: string; responsibilities: string; ai_solution: string; ad_link: string; scan: string;
};
type TargetRow = Record<string, string>;

const TOOLS = [
  { name: "data_validation", status: "live", description: "Upload spreadsheets, flag gaps and anomalies, draft notes and a report pack." },
  { name: "bookkeeping", status: "built", description: "Invoices and receipts in, coded entries, reconciliations and a month-end checklist out." },
  { name: "compliance", status: "in_progress", description: "Registers, evidence mapped to ISO clauses, expiry alerts and MI packs." },
  { name: "listings", status: "queued", description: "Product photos and details in, titles, descriptions and a marketplace CSV out." },
  { name: "leasehold_packs", status: "queued", description: "Property records in, pre-filled LPE1/FME1 packs and a key-dates tracker out." },
  { name: "bid_writer", status: "queued", description: "Tender pack in, questions extracted, answers drafted from the bid library." },
];

// Worked example so the listing view shows duty coverage before the Claude backfill runs.
const WESTONE_COVERAGE = [
  { duty: "Lead the preparation and submission of SQs, PQQs, ITTs and framework applications.", coverage: "partial", how: "Drafts and assembles each submission; a person uploads it to the portal" },
  { duty: "Write high-quality, persuasive and tailored tender responses.", coverage: "full", how: "Drafts every answer from their bid library, scored against the criteria" },
  { duty: "Manage multiple bid opportunities and submission deadlines simultaneously.", coverage: "full", how: "Deadline tracker per tender with reminders" },
  { duty: "Coordinate contributions from operational, commercial and support teams.", coverage: "partial", how: "Emails each team the inputs still missing and chases them" },
  { duty: "Maintain and improve the company bid library and case studies.", coverage: "full", how: "Tags past answers and adds new wins to the library automatically" },
  { duty: "Support framework registrations and procurement portal management.", coverage: "none", how: "Portal logins and registrations stay with their team" },
  { duty: "Research clients, competitors and market opportunities.", coverage: "partial", how: "Briefing on each buyer and its past contracts before writing" },
] as const;

function readCsv<T>(file: string): T[] {
  const p = path.join(process.cwd(), "seed", file);
  return parse(fs.readFileSync(p, "utf8"), { columns: true, skip_empty_lines: true }) as T[];
}

function toolFor(status: string): string | null {
  const m = status.match(/\(([a-z_]+)/);
  if (m) return m[1];
  return null;
}

export async function seed({ reset = false } = {}): Promise<string> {
  const db = await getDb();
  const existing = await db.select({ n: sql<number>`count(*)::int` }).from(leads);
  if (existing[0].n > 0 && !reset) return `Already seeded (${existing[0].n} leads). Nothing changed.`;
  if (reset) {
    await db.execute(sql`TRUNCATE demos, activities, leads, contacts, diagnoses, jobs, companies, tools, runs, settings RESTART IDENTITY CASCADE`);
  }

  const rows = readCsv<JobRow>("job_problems.csv");
  const targets = readCsv<TargetRow>("target_contacts.csv");
  const targetByReed = new Map(targets.map((t) => [reedIdFromUrl(t["Job ad link"]), t]));

  const runA = await db.insert(runs).values({ trigger: "seed", label: "Core desk roles (71 keywords)", startedAt: new Date("2026-11-05T09:40:00Z"), finishedAt: new Date("2026-11-05T10:30:00Z"), counts: { scanned: 3723, after_noise: 271, desk: 152, strong: 56 } }).returning();
  const runB = await db.insert(runs).values({ trigger: "seed", label: "Senior production roles (35 keywords)", startedAt: new Date("2026-11-05T21:20:00Z"), finishedAt: new Date("2026-11-05T21:50:00Z"), counts: { scanned: 1395, after_noise: 238, desk: 105, strong: 65 } }).returning();

  const toolIds = new Map<string, number>();
  for (const t of TOOLS) {
    const [r] = await db.insert(tools).values(t).returning();
    toolIds.set(t.name, r.id);
  }

  const companyIds = new Map<string, number>();
  const ensureCompany = async (name: string, size: string) => {
    const key = normaliseName(name);
    if (companyIds.has(key)) return companyIds.get(key)!;
    const [c] = await db.insert(companies).values({ name: name.trim(), normalisedName: key, sizeBand: size || "unknown" }).returning();
    companyIds.set(key, c.id);
    return c.id;
  };

  let nLeads = 0;
  const leadByReed = new Map<string, { leadId: number; companyId: number }>();
  for (const r of rows) {
    const reedId = reedIdFromUrl(r.ad_link);
    const target = targetByReed.get(reedId);
    const companyId = await ensureCompany(r.company, r.size_guess);
    const salaryNum = parseInt((r.salary || "").replace(/[^0-9]/g, ""), 10);
    const [job] = await db.insert(jobs).values({
      sourceJobId: reedId, companyId, title: r.role, location: r.location,
      salaryText: r.salary, salaryMax: Number.isFinite(salaryNum) ? salaryNum : null,
      closesAt: ukDate(r.closes), url: r.ad_link,
      responsibilities: r.responsibilities ? r.responsibilities.split(" | ").map((s) => s.trim()).filter(Boolean) : null,
      responsibilitiesSource: r.responsibilities ? "section" : null,
      runId: r.scan.startsWith("core") ? runA[0].id : runB[0].id, scan: r.scan, state: "seeded", companyName: r.company,
    }).returning();

    const ease = parseInt(r.ease_of_build_1to5, 10);
    const replace = parseInt(r.replace_score, 10);
    const isWestoneBid = reedId === "57447846";
    await db.insert(diagnoses).values({
      jobId: job.id, deskFit: r.desk_fit.toLowerCase(), easeOfBuild: ease, replaceScore: replace, improveScore: 10 - replace,
      problem: r.problem, evidence: r.evidence_from_ad || null, solution: r.ai_solution,
      dutyCoverage: isWestoneBid ? [...WESTONE_COVERAGE] as never : null,
      callOpener: isWestoneBid ? "I saw you're hiring a bid writer because your tender volume has grown. I've built a tool that drafts tender answers from your past bids. Could I show you in ten minutes?" : null,
      model: "seed (5 Nov 2026, Claude in chat)",
    });

    if (r.desk_fit !== "Strong" && !target) continue;
    const phoneBonus = target && target["Phone"] ? 2 : 0;
    const score = replace * ease + (r.size_guess === "SMB" ? 2 : 0) + phoneBonus;
    const stage = target ? (reedId === "57472375" ? "Contacted" : "Researched") : "New";
    const [lead] = await db.insert(leads).values({ jobId: job.id, companyId, stage, score }).returning();
    leadByReed.set(reedId, { leadId: lead.id, companyId });
    await db.insert(activities).values({ leadId: lead.id, type: "system", body: `Lead created from hunt of 5 Nov (${r.scan})`, createdAt: new Date("2026-11-05T22:00:00Z") });
    nLeads++;
  }

  // Contacts, next actions and demos for the 16 targets.
  for (const t of targets) {
    const reedId = reedIdFromUrl(t["Job ad link"]);
    const hit = leadByReed.get(reedId);
    if (!hit) continue;
    const phone = (t["Phone"] || "").replace(/^'/, "").trim() || null;
    if (phone) await db.update(companies).set({ mainPhone: phone }).where(sql`id = ${hit.companyId}`);
    const name = (t["Contact"] || "").trim();
    let contactName: string | null = null;
    if (name && name !== "NOT FOUND") {
      const email = (t["Email"] || "").trim();
      const status = /verified\)/.test(email) && !/unverified/.test(email) ? "verified" : email ? "unverified" : "unknown";
      await db.insert(contacts).values({
        companyId: hit.companyId, name, title: t["Title"] || null,
        email: email ? email.replace(/\s*\((un)?verified\)/, "") : null, emailStatus: status,
        phone, linkedin: t["LinkedIn"] || null, source: "getleads", notes: t["Notes"] || null,
      });
      contactName = name.startsWith("Ask for") ? null : name.split(/[ /]/)[0];
    }
    const isNfu = reedId === "57472375";
    await db.update(leads).set({
      nextAction: isNfu ? "Follow up Thomas Wilkins" : contactName ? `Call ${contactName}` : "Call the main line",
      nextActionAt: isNfu ? "2026-11-06" : reedId === "57447846" ? "2026-11-06" : null,
    }).where(sql`id = ${hit.leadId}`);
    if (isNfu) {
      await db.insert(activities).values({ leadId: hit.leadId, type: "linkedin", outcome: "other", body: "Sales Navigator InMail to Thomas Wilkins with the Loom of the meter data checker demo.", createdAt: new Date("2026-11-05T18:00:00Z") });
      await db.insert(activities).values({ leadId: hit.leadId, type: "email", outcome: "other", body: "Same pitch by email to thomas.wilkins@nfuenergy.co.uk.", createdAt: new Date("2026-11-05T18:05:00Z") });
    }
    let tool = toolFor(t["Build status"] || "");
    let status = "queued";
    if (isNfu) { tool = "data_validation"; status = "live"; }
    else if (tool === "bookkeeping") status = "built";
    else if (tool === "compliance") status = "in_progress";
    await db.insert(demos).values({
      leadId: hit.leadId, toolId: tool ? toolIds.get(tool) ?? null : null, status,
      loomNote: isNfu ? "Sent 5 Nov" : null,
    });
  }

  return `Seeded ${rows.length} jobs, ${nLeads} leads, ${targets.length} targets, ${TOOLS.length} tools.`;
}
