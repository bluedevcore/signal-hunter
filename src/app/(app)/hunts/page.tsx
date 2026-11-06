import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { dbReady, runsData } from "@/lib/queries";
import { getDb, schema } from "@/db";
import { HuntProgress } from "@/components/HuntProgress";
import { SubmitButton } from "@/components/Pending";
import { startHuntAction, startBackfillAction, stopRunAction } from "@/lib/actions";
import { SETTINGS } from "@/lib/hunt/config";

const EST: [string, string, number][] = [
  ["Scan Reed", "Desk roles, £18k–100k, direct employers", 900],
  ["Remove the noise", "Agencies, public sector, big brands, scams", 65],
  ["Read the full ad", "Drop hands-on roles", 37],
  ["Diagnose", "Duties, problem, solution, scores", 37],
  ["Strong desk fit", "On a computer most of the day", 14],
  ["Companies House", "Active SME, directors named", 9],
  ["New leads", "Ranked by ease of build", 8],
];

export default async function HuntsPage() {
  if (!(await dbReady())) redirect("/setup");
  const runs = await runsData();
  const running = runs.find((r) => r.status === "running");
  const lastHunt = runs.find((r) => r.kind === "hunt" && r.trigger !== "seed" && r.status !== "running");
  const db = await getDb();
  const [miss] = await db.execute(sql`select count(*)::int as n from leads l join jobs j on j.id = l.job_id left join diagnoses d on d.job_id = j.id where d.duty_coverage is null or jsonb_array_length(d.duty_coverage) = 0`).then((r) => ("rows" in r ? (r.rows as { n: number }[]) : (r as unknown as { n: number }[])));
  const missing = miss?.n ?? 0;

  const c = lastHunt?.counts || {};
  const funnel: [string, string, number][] = lastHunt
    ? [
        ["Scan Reed", `${SETTINGS.keywords.length} keywords, last ${SETTINGS.daysBack} days, new ads only`, c.scanned || 0],
        ["Remove the noise", "Agencies, public sector, big brands, scams", c.after_noise || 0],
        ["Read the full ad", "Drop hands-on roles", c.desk || 0],
        ["Diagnose", "Duties, problem, solution, scores", c.diagnosed || 0],
        ["Strong desk fit", "On a computer most of the day", c.strong || 0],
        ["Companies House", "SME or unknown size", c.sme || 0],
        ["New leads", "Open ads, ranked by ease of build", c.new_leads || 0],
      ]
    : EST;
  const top = Math.max(1, funnel[0][2]);
  const drops = Object.entries(c).filter(([k]) => k.startsWith("drop: ")).sort((a, b) => b[1] - a[1]);
  const fmt = (n?: number) => (n === undefined ? "—" : n.toLocaleString("en-GB"));

  return (
    <>
      <header className="flex flex-wrap gap-4 justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="kicker">Hunts · every Monday 06:00</div>
          <h1 className="m-0 text-[44px] font-extrabold" style={{ letterSpacing: "-0.03em" }}>What the hunter kept, and why</h1>
        </div>
        <div className="flex gap-2 items-center">
          {running ? (
            <form action={stopRunAction}><input type="hidden" name="runId" value={running.id} /><SubmitButton className="btn btn-light h-11" pendingText="Stopping…">Stop run</SubmitButton></form>
          ) : (
            <>
              {missing > 0 && <form action={startBackfillAction}><SubmitButton className="btn btn-light h-11" pendingText="Starting…" title="Re-reads each ad and has Claude fill in duties, coverage and scores">Backfill {missing} leads with Claude</SubmitButton></form>}
              <form action={startHuntAction}><SubmitButton className="btn btn-dark h-11" pendingText="Starting…">Run hunt now</SubmitButton></form>
            </>
          )}
        </div>
      </header>

      {running && <HuntProgress initial={{ id: running.id, kind: running.kind, phase: running.phase, status: running.status, counts: running.counts, error: running.error }} />}

      <div className="flex flex-wrap gap-6 items-start">
        <section className="card p-7 flex flex-col gap-3.5" style={{ flex: "3 1 560px", minWidth: 0 }}>
          <div className="flex justify-between items-baseline flex-wrap gap-2">
            <h2 className="m-0 text-xl font-bold">{lastHunt ? "Last hunt" : "Weekly funnel"}</h2>
            <span className="text-[13px] text-mute">{lastHunt ? new Date(lastHunt.startedAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "Estimate per week, Reed only, from the 5 Nov ratios"}</span>
          </div>
          {funnel.map(([name, note, n], i) => (
            <div key={name} className="grid gap-4 items-center" style={{ gridTemplateColumns: "220px minmax(0,1fr) 64px" }}>
              <span className="flex flex-col gap-0.5"><span className="text-sm font-semibold">{name}</span><span className="text-xs text-mute">{note}</span></span>
              <span className="h-7 bg-page rounded-md overflow-hidden flex"><span className="rounded-md" style={{ width: `${Math.max(2, Math.round(Math.sqrt(n / top) * 100))}%`, background: i === funnel.length - 1 ? "#B4321F" : "#1B1A17" }} /></span>
              <span className="font-mono text-sm font-semibold text-right">{lastHunt ? fmt(n) : `~${n}`}</span>
            </div>
          ))}
        </section>
        <section className="card p-7 flex flex-col gap-3" style={{ flex: "2 1 340px", minWidth: 0 }}>
          <h2 className="m-0 text-xl font-bold">Why jobs were dropped</h2>
          {drops.length ? (
            drops.map(([k, v]) => <div key={k} className="flex justify-between py-3 border-t border-line-soft text-sm"><span>{k.slice(6)}</span><span className="font-mono font-semibold">{fmt(v)}</span></div>)
          ) : (
            <p className="m-0 text-[13px] text-mute">Counts per rule appear here after your first hunt.</p>
          )}
        </section>
      </div>

      <section className="card overflow-x-auto">
        <div style={{ minWidth: 980 }}>
          <h2 className="m-0 px-6 pt-5 pb-2 text-xl font-bold">Run history</h2>
          <div className="grid gap-4 px-6 py-3 border-b border-line label" style={{ gridTemplateColumns: "170px minmax(0,1fr) 100px 100px 100px 90px 90px 90px" }}>
            <span>Run</span><span>What</span><span>New ads</span><span>Filtered</span><span>Desk roles</span><span>Strong</span><span>Leads</span><span>Cost</span>
          </div>
          {runs.map((r) => (
            <div key={r.id} className="grid gap-4 px-6 py-4 border-b border-line-soft text-sm items-center" style={{ gridTemplateColumns: "170px minmax(0,1fr) 100px 100px 100px 90px 90px 90px" }}>
              <span className="font-mono">{new Date(r.startedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}</span>
              <span className="flex flex-col"><span>{r.label}</span>{r.status !== "done" && <span className="text-xs" style={{ color: r.status === "failed" ? "#B4321F" : "#5F5C55" }}>{r.status}{r.error ? `: ${r.error}` : ""}</span>}</span>
              <span className="font-mono">{fmt(r.counts?.scanned)}</span>
              <span className="font-mono">{fmt(r.counts?.after_noise)}</span>
              <span className="font-mono">{fmt(r.counts?.desk)}</span>
              <span className="font-mono font-semibold">{fmt(r.counts?.strong)}</span>
              <span className="font-mono">{fmt(r.counts?.new_leads)}</span>
              <span className="font-mono text-mute">{r.counts?.cost_pence ? `£${(r.counts.cost_pence / 100).toFixed(2)}` : "—"}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
