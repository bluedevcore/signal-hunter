import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normaliseName, today } from "@/lib/util";
import { SETTINGS } from "./config";
import { noiseFilter, physicalScore } from "./filters";
import { parseSections } from "./parse";
import { reedDate, reedJob, reedSearch } from "./reed";
import { diagnoseJob } from "./diagnose";
import { checkCompany } from "./companies";
import { datasetItems, domainOf, runStatus, startPlacesRun } from "./enrich";
import { claudeConfigured } from "@/lib/claude";

const { runs, jobs, companies, diagnoses, contacts, leads, activities } = schema;
type Run = typeof runs.$inferSelect;
type Counts = Record<string, number>;

export const PHASES = ["scan", "filter", "describe", "diagnose", "company", "enrich", "leads", "done"] as const;

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const q = [...items];
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await fn(q.shift()!); }));
}

export async function activeRun(): Promise<Run | null> {
  const db = await getDb();
  const [r] = await db.select().from(runs).where(eq(runs.status, "running")).limit(1);
  return r || null;
}

export async function startHunt(trigger: "cron" | "manual"): Promise<Run> {
  const cur = await activeRun();
  if (cur) return cur;
  const db = await getDb();
  const [r] = await db.insert(runs).values({ trigger, kind: "hunt", label: `Weekly hunt (${SETTINGS.keywords.length} keywords)`, status: "running", phase: "scan", cursor: { k: 0, skip: 0 }, counts: {} }).returning();
  return r;
}

/** Re-diagnose existing leads with Claude (fills responsibilities + duty coverage for seeded jobs). */
export async function startBackfill(onlyMissing = true): Promise<Run> {
  const cur = await activeRun();
  if (cur) return cur;
  const db = await getDb();
  const [r] = await db.insert(runs).values({ trigger: "manual", kind: "backfill", label: "Backfill: Claude diagnosis of existing leads", status: "running", phase: "describe", cursor: {}, counts: {} }).returning();
  const rows = await db.select({ id: jobs.id, cov: diagnoses.dutyCoverage }).from(leads).innerJoin(jobs, eq(leads.jobId, jobs.id)).leftJoin(diagnoses, eq(diagnoses.jobId, jobs.id));
  const ids = rows.filter((x) => !onlyMissing || !x.cov || x.cov.length === 0).map((x) => x.id);
  if (ids.length) await db.update(jobs).set({ runId: r.id, state: "kept" }).where(inArray(jobs.id, ids));
  await bump(r.id, { queued: ids.length });
  return r;
}

async function release(runId: number) {
  const db = await getDb();
  await db.update(runs).set({ lockedUntil: null }).where(eq(runs.id, runId));
}

async function bump(runId: number, add: Counts, set?: Partial<Run>) {
  const db = await getDb();
  const [r] = await db.select({ counts: runs.counts }).from(runs).where(eq(runs.id, runId));
  const counts: Counts = { ...(r?.counts || {}) };
  for (const [k, v] of Object.entries(add)) counts[k] = Math.round(((counts[k] || 0) + v) * 100) / 100;
  await db.update(runs).set({ counts, ...(set || {}) }).where(eq(runs.id, runId));
}

async function setPhase(run: Run, phase: string, cursor: Record<string, unknown> = {}) {
  const db = await getDb();
  await db.update(runs).set({ phase, cursor, ...(phase === "done" ? { status: "done", finishedAt: new Date() } : {}) }).where(eq(runs.id, run.id));
}

async function fail(run: Run, error: string) {
  const db = await getDb();
  await db.update(runs).set({ status: "failed", error, finishedAt: new Date() }).where(eq(runs.id, run.id));
}

/** Advance the running hunt as far as the time budget allows. Safe to call repeatedly (cron every minute, or the Hunts page). */
export async function tick(budgetMs = 50_000): Promise<{ run: Run | null; message: string }> {
  const deadline = Date.now() + budgetMs;
  let run = await activeRun();
  if (!run) return { run: null, message: "No hunt running" };
  const db = await getDb();
  // One worker at a time: take a lease on the run.
  const lease = await db.update(runs).set({ lockedUntil: new Date(Date.now() + budgetMs + 15_000) })
    .where(sql`${runs.id} = ${run.id} and (${runs.lockedUntil} is null or ${runs.lockedUntil} < now())`).returning({ id: runs.id });
  if (!lease.length) return { run, message: "Another worker is running this hunt" };
  try {
    while (Date.now() < deadline) {
      [run] = await db.select().from(runs).where(eq(runs.id, run!.id));
      if (!run || run.status !== "running") break;
      const left = () => deadline - Date.now();
      switch (run.phase) {
        case "scan": await scan(run, left); break;
        case "filter": await filter(run); break;
        case "describe": await describe(run, left); break;
        case "diagnose": if (!(await diagnose(run, left))) { await release(run.id); return { run, message: "Waiting for ANTHROPIC_API_KEY" }; } break;
        case "company": await company(run, left); break;
        case "enrich": if (!(await enrich(run))) { await release(run.id); return { run, message: "Waiting for Apify" }; } break;
        case "leads": await makeLeads(run); break;
        default: await setPhase(run, "done");
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Transient API errors: record and retry next tick rather than killing the run.
    await bump(run!.id, { errors: 1 }, { error: msg.slice(0, 500) });
    const [r] = await db.select({ counts: runs.counts }).from(runs).where(eq(runs.id, run!.id));
    if ((r?.counts?.errors || 0) >= 25) await fail(run!, msg);
    await release(run!.id);
    return { run, message: `Error: ${msg}` };
  }
  await db.update(runs).set({ lockedUntil: null }).where(eq(runs.id, run!.id));
  [run] = await db.select().from(runs).where(eq(runs.id, run!.id));
  return { run, message: run?.phase || "" };
}

async function scan(run: Run, left: () => number) {
  const db = await getDb();
  const cur = (run.cursor || {}) as { k?: number; skip?: number };
  let k = cur.k || 0, skip = cur.skip || 0;
  const cutoff = new Date(Date.now() - SETTINGS.daysBack * 86400000).toISOString().slice(0, 10);
  while (left() > 5000 && k < SETTINGS.keywords.length) {
    const { items } = await reedSearch(SETTINGS.keywords[k], skip);
    let fresh = 0, inserted = 0;
    for (const it of items) {
      const posted = reedDate(it.date);
      if (posted && posted < cutoff) continue;
      fresh++;
      const res = await db.insert(jobs).values({
        source: "reed", sourceJobId: String(it.jobId), companyName: it.employerName, title: it.jobTitle, location: it.locationName,
        salaryMin: it.minimumSalary ? Math.round(it.minimumSalary) : null, salaryMax: it.maximumSalary ? Math.round(it.maximumSalary) : null,
        salaryText: it.maximumSalary ? `£${Math.round(it.maximumSalary).toLocaleString("en-GB")}` : "Not stated",
        postedAt: posted, closesAt: reedDate(it.expirationDate), url: it.jobUrl, description: it.jobDescription,
        runId: run.id, state: "new", scan: "weekly hunt",
      }).onConflictDoNothing().returning({ id: jobs.id });
      inserted += res.length;
    }
    await bump(run.id, { scanned: inserted, seen: items.length });
    if (items.length === 100 && fresh > 0 && skip + 100 < SETTINGS.perKeywordMax) skip += 100;
    else { k++; skip = 0; }
    await db.update(runs).set({ cursor: { k, skip } }).where(eq(runs.id, run.id));
  }
  if (k >= SETTINGS.keywords.length) await setPhase(run, "filter");
}

async function filter(run: Run) {
  const db = await getDb();
  const rows = await db.select().from(jobs).where(and(eq(jobs.runId, run.id), eq(jobs.state, "new")));
  const per = new Map<string, number>();
  rows.forEach((r) => per.set(r.companyName || "", (per.get(r.companyName || "") || 0) + 1));
  const reasons: Counts = {};
  let kept = 0;
  for (const r of rows) {
    const why = noiseFilter({ title: r.title, company: r.companyName || "", snippet: r.description || "", salaryMax: r.salaryMax, salaryMin: r.salaryMin, openingsAtEmployer: per.get(r.companyName || "") || 0 });
    if (why) reasons[why] = (reasons[why] || 0) + 1;
    else kept++;
    await db.update(jobs).set(why ? { state: "dropped", filterStatus: "dropped", dropReason: why } : { state: "kept" }).where(eq(jobs.id, r.id));
  }
  await bump(run.id, { after_noise: kept, ...Object.fromEntries(Object.entries(reasons).map(([k, v]) => [`drop: ${k}`, v])) });
  await setPhase(run, "describe");
}

async function describe(run: Run, left: () => number) {
  const db = await getDb();
  while (left() > 8000) {
    const batch = await db.select().from(jobs).where(and(eq(jobs.runId, run.id), eq(jobs.state, "kept"))).limit(15);
    if (!batch.length) return setPhase(run, "diagnose");
    let desk = 0, hands = 0;
    await pool(batch, 5, async (j) => {
      const full = await reedJob(j.sourceJobId);
      if (!full) {
        // Ad gone (closed). Backfills keep what they have; hunts drop it.
        if (run.kind === "backfill") await db.update(jobs).set({ state: "described" }).where(eq(jobs.id, j.id));
        else await db.update(jobs).set({ state: "dropped", filterStatus: "dropped", dropReason: "Ad removed" }).where(eq(jobs.id, j.id));
        return;
      }
      const { responsibilities, requirements, text } = parseSections(full.jobDescription || "");
      const physical = physicalScore(`${j.title}\n${text}`);
      const handsOn = run.kind === "hunt" && physical >= 4;
      if (handsOn) hands++; else desk++;
      await db.update(jobs).set({
        descriptionHtml: full.jobDescription, description: text,
        responsibilities: responsibilities.length ? responsibilities : run.kind === "backfill" ? undefined : null,
        responsibilitiesSource: responsibilities.length ? "section" : run.kind === "backfill" ? undefined : null,
        requirements: requirements.length ? requirements : null,
        closesAt: reedDate(full.expirationDate) || j.closesAt,
        ...(handsOn ? { state: "dropped", filterStatus: "dropped", dropReason: "Hands-on role (in-person signals in the ad)" } : { state: "described" }),
      }).where(eq(jobs.id, j.id));
    });
    await bump(run.id, { desk, ...(hands ? { "drop: Hands-on role": hands } : {}) });
  }
}

/** Returns false when the run must pause (no Claude key). */
async function diagnose(run: Run, left: () => number): Promise<boolean> {
  if (!claudeConfigured() && process.env.HUNT_MOCK_CLAUDE !== "1") {
    await db_err(run, "ANTHROPIC_API_KEY is not set: add it in Vercel and the hunt will carry on from the diagnosis step.");
    return false;
  }
  const db = await getDb();
  while (left() > 25000) {
    const batch = await db.select({ job: jobs, company: companies }).from(jobs).leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(eq(jobs.runId, run.id), eq(jobs.state, "described"))).limit(4);
    if (!batch.length) {
      await setPhase(run, run.kind === "backfill" ? "done" : "company");
      return true;
    }
    let strong = 0, pence = 0;
    await pool(batch, 4, async ({ job: j, company: c }) => {
      const { data, pence: p } = await diagnoseJob({
        title: j.title, company: c?.name || j.companyName || "", salary: j.salaryText || "Not stated", location: j.location || "",
        parsedResponsibilities: (j.responsibilitiesSource === "section" && j.responsibilities) || [], requirements: j.requirements || [],
        text: j.description || (j.responsibilities || []).join("\n"),
      });
      pence += p;
      const values = {
        jobId: j.id, deskFit: data.desk_fit, easeOfBuild: data.ease_of_build, replaceScore: data.replace_score, improveScore: 10 - data.replace_score,
        problem: data.problem, evidence: data.evidence, solution: data.solution, dutyCoverage: data.duty_coverage, systems: data.systems,
        callOpener: data.call_opener, model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
      };
      await db.insert(diagnoses).values(values).onConflictDoUpdate({ target: diagnoses.jobId, set: { ...values, createdAt: new Date() } });
      await db.update(jobs).set({
        responsibilities: data.responsibilities,
        responsibilitiesSource: j.responsibilitiesSource === "section" ? "section" : "claude",
        state: run.kind === "backfill" ? "lead" : data.desk_fit === "strong" ? "diagnosed" : "weak",
      }).where(eq(jobs.id, j.id));
      if (data.desk_fit === "strong") strong++;
      if (run.kind === "backfill") {
        const [l] = await db.select().from(leads).where(eq(leads.jobId, j.id));
        if (l) {
          const [co] = await db.select().from(companies).where(eq(companies.id, l.companyId));
          await db.update(leads).set({ score: data.replace_score * data.ease_of_build + (co?.sizeBand === "SMB" ? 2 : 0) + (co?.mainPhone ? 2 : 0) }).where(eq(leads.id, l.id));
        }
      }
    });
    await bump(run.id, { diagnosed: batch.length, strong, cost_pence: pence });
  }
  return true;
}

async function db_err(run: Run, msg: string) {
  const db = await getDb();
  await db.update(runs).set({ error: msg }).where(eq(runs.id, run.id));
}

async function ensureCompany(name: string) {
  const db = await getDb();
  const key = normaliseName(name);
  const [c] = await db.select().from(companies).where(eq(companies.normalisedName, key));
  if (c) return c;
  const [n] = await db.insert(companies).values({ name: name.trim(), normalisedName: key }).onConflictDoNothing().returning();
  return n || (await db.select().from(companies).where(eq(companies.normalisedName, key)))[0];
}

async function company(run: Run, left: () => number) {
  const db = await getDb();
  while (left() > 8000) {
    const batch = await db.select().from(jobs).where(and(eq(jobs.runId, run.id), eq(jobs.state, "diagnosed"))).limit(8);
    if (!batch.length) return setPhase(run, "enrich");
    let sme = 0, large = 0;
    for (const j of batch) {
      const c = await ensureCompany(j.companyName || "Unknown");
      let size = c.sizeBand;
      if (!c.chNumber && process.env.COMPANIES_HOUSE_API_KEY) {
        const chk = await checkCompany(c.name, j.location);
        if (chk) {
          size = chk.sizeBand;
          await db.update(companies).set({ chNumber: chk.number, chStatus: chk.status, accountsType: chk.accountsType, sizeBand: chk.sizeBand, directors: chk.directors, registeredAddress: chk.address, isGroup: chk.isGroup }).where(eq(companies.id, c.id));
          const existing = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.companyId, c.id));
          if (!existing.length) for (const d of chk.directors.slice(0, 4)) await db.insert(contacts).values({ companyId: c.id, name: d, title: "Director (Companies House)", source: "companies_house" });
        }
      }
      const isLarge = size === "Large/group";
      if (isLarge) large++; else sme++;
      await db.update(jobs).set({ companyId: c.id, ...(isLarge ? { state: "large", dropReason: "Large company (Companies House accounts)" } : { state: "checked" }) }).where(eq(jobs.id, j.id));
    }
    await bump(run.id, { sme, ...(large ? { "drop: Large company": large } : {}) });
  }
}

/** Returns false while waiting on an Apify run. */
async function enrich(run: Run): Promise<boolean> {
  const db = await getDb();
  const cur = (run.cursor || {}) as { apify?: { runId: string; datasetId: string; map: Record<string, number> } };
  const pending = await db.select({ job: jobs, company: companies }).from(jobs).innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(eq(jobs.runId, run.id), eq(jobs.state, "checked")));
  if (!pending.length) { await setPhase(run, "leads"); return true; }

  if (cur.apify) {
    const status = await runStatus(cur.apify.runId);
    if (status === "RUNNING" || status === "READY") return false;
    if (status === "SUCCEEDED") {
      const items = await datasetItems(cur.apify.datasetId);
      for (const it of items) {
        const cid = cur.apify.map[it.searchString || ""];
        if (!cid) continue;
        const website = it.website || null;
        await db.update(companies).set({ mainPhone: it.phone || it.phoneUnformatted || null, website, domain: domainOf(website) }).where(and(eq(companies.id, cid), isNull(companies.mainPhone)));
      }
      await bump(run.id, { enriched: items.filter((i) => i.phone).length });
    }
    const ids = Object.values(cur.apify.map);
    await db.update(jobs).set({ state: "enriched" }).where(and(eq(jobs.runId, run.id), eq(jobs.state, "checked"), inArray(jobs.companyId, ids)));
    await setPhase(run, "enrich", {});
    return true;
  }

  const needPhone = pending.filter((p) => !p.company.mainPhone);
  const havePhone = pending.filter((p) => p.company.mainPhone).map((p) => p.job.id);
  if (havePhone.length) await db.update(jobs).set({ state: "enriched" }).where(inArray(jobs.id, havePhone));
  if (!needPhone.length || !process.env.APIFY_TOKEN) {
    if (needPhone.length) await db.update(jobs).set({ state: "enriched" }).where(inArray(jobs.id, needPhone.map((p) => p.job.id)));
    return true;
  }
  const map: Record<string, number> = {};
  for (const p of needPhone.slice(0, 60)) map[`${p.company.name}, ${p.job.location || "UK"}`] = p.company.id;
  const started = await startPlacesRun(Object.keys(map));
  await setPhase(run, "enrich", { apify: { ...started, map } });
  return false;
}

async function makeLeads(run: Run) {
  const db = await getDb();
  const rows = await db.select({ job: jobs, dx: diagnoses, company: companies }).from(jobs)
    .innerJoin(diagnoses, eq(diagnoses.jobId, jobs.id)).innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(eq(jobs.runId, run.id), eq(jobs.state, "enriched")));
  const t = today();
  let made = 0;
  for (const { job: j, dx, company: c } of rows) {
    if (j.closesAt && j.closesAt < t) { await db.update(jobs).set({ state: "closed" }).where(eq(jobs.id, j.id)); continue; }
    const named = await db.select().from(contacts).where(eq(contacts.companyId, c.id));
    const score = dx.replaceScore * dx.easeOfBuild + (c.sizeBand === "SMB" ? 2 : 0) + (c.mainPhone || named.some((p) => p.phone) ? 2 : 0);
    const first = named.find((p) => !p.name.startsWith("Ask for"));
    const [l] = await db.insert(leads).values({ jobId: j.id, companyId: c.id, stage: "New", score, nextAction: first ? `Call ${first.name.split(" ")[0]}` : c.mainPhone ? "Call the main line" : "Find contacts" }).onConflictDoNothing().returning();
    if (!l) continue;
    made++;
    await db.insert(activities).values({ leadId: l.id, type: "system", body: `Lead created from hunt #${run.id}` });
    const siblings = await db.select({ id: leads.id }).from(leads).where(sql`${leads.companyId} = ${c.id} and ${leads.id} <> ${l.id}`);
    for (const s of siblings) await db.insert(activities).values({ leadId: s.id, type: "system", body: `Also hiring: ${j.title}` });
    await db.update(jobs).set({ state: "lead" }).where(eq(jobs.id, j.id));
  }
  await bump(run.id, { new_leads: made });
  await setPhase(run, "done");
}
