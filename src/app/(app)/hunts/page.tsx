import { redirect } from "next/navigation";
import { dbReady, runsData } from "@/lib/queries";

const FUNNEL: [string, string, number][] = [
  ["Scan Reed", "Desk roles, £18k–100k, direct employers", 900],
  ["Remove the noise", "Agencies, public sector, big brands, scams", 65],
  ["Read the full ad", "Drop hands-on roles", 37],
  ["Strong desk fit", "On a computer most of the day", 14],
  ["Companies House", "Active SME, directors named", 9],
  ["Diagnose", "Duties, problem, solution, scores", 8],
  ["Enrich", "Decision maker and phone", 8],
  ["New leads", "Ranked by ease of build", 8],
];

export default async function HuntsPage() {
  if (!(await dbReady())) redirect("/setup");
  const runs = await runsData();
  const fmt = (n?: number) => (n === undefined ? "—" : n.toLocaleString("en-GB"));
  return (
    <>
      <header className="flex flex-wrap gap-4 justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="kicker">Hunts · every Monday 06:00</div>
          <h1 className="m-0 text-[44px] font-extrabold" style={{ letterSpacing: "-0.03em" }}>What the hunter kept, and why</h1>
        </div>
        <button className="btn btn-dark h-11" disabled title="The hunt pipeline arrives in build step 3">Run hunt now</button>
      </header>

      <div className="flex flex-wrap gap-6 items-start">
        <section className="card p-7 flex flex-col gap-3.5" style={{ flex: "3 1 560px", minWidth: 0 }}>
          <div className="flex justify-between items-baseline flex-wrap gap-2">
            <h2 className="m-0 text-xl font-bold">Weekly funnel</h2>
            <span className="text-[13px] text-mute">Estimate per week, Reed only, from the 5 Nov ratios</span>
          </div>
          {FUNNEL.map(([name, note, n], i) => (
            <div key={name} className="grid gap-4 items-center" style={{ gridTemplateColumns: "220px minmax(0,1fr) 64px" }}>
              <span className="flex flex-col gap-0.5"><span className="text-sm font-semibold">{name}</span><span className="text-xs text-mute">{note}</span></span>
              <span className="h-7 bg-page rounded-md overflow-hidden flex"><span className="rounded-md" style={{ width: `${Math.max(3, Math.round(Math.sqrt(n / 900) * 100))}%`, background: i === FUNNEL.length - 1 ? "#B4321F" : "#1B1A17" }} /></span>
              <span className="font-mono text-sm font-semibold text-right">~{n}</span>
            </div>
          ))}
        </section>
        <section className="card p-7 flex flex-col gap-3" style={{ flex: "2 1 340px", minWidth: 0 }}>
          <h2 className="m-0 text-xl font-bold">Why jobs were dropped</h2>
          <p className="m-0 text-[13px] text-mute">£55k–100k ads in the 5 Nov scan. Live counts per rule arrive with the hunt pipeline (build step 3).</p>
          {[["Not a desk-admin title", 198], ["Manager / senior / lead title", 22], ["Employer with 6+ openings", 1], ["Kept", 1]].map(([k, v]) => (
            <div key={k} className="flex justify-between py-3 border-t border-line-soft text-sm"><span>{k}</span><span className="font-mono font-semibold">{v}</span></div>
          ))}
        </section>
      </div>

      <section className="card overflow-x-auto">
        <div style={{ minWidth: 900 }}>
          <h2 className="m-0 px-6 pt-5 pb-2 text-xl font-bold">Run history</h2>
          <div className="grid gap-4 px-6 py-3 border-b border-line label" style={{ gridTemplateColumns: "170px minmax(0,1fr) 110px 110px 110px 110px 90px" }}>
            <span>Run</span><span>Search</span><span>Listings</span><span>After filters</span><span>Desk roles</span><span>Strong</span><span>Cost</span>
          </div>
          {runs.map((r) => (
            <div key={r.id} className="grid gap-4 px-6 py-4 border-b border-line-soft text-sm items-center" style={{ gridTemplateColumns: "170px minmax(0,1fr) 110px 110px 110px 110px 90px" }}>
              <span className="font-mono">{new Date(r.startedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}</span>
              <span>{r.label}</span>
              <span className="font-mono">{fmt(r.counts?.scanned)}</span>
              <span className="font-mono">{fmt(r.counts?.after_noise)}</span>
              <span className="font-mono">{fmt(r.counts?.desk)}</span>
              <span className="font-mono font-semibold">{fmt(r.counts?.strong)}</span>
              <span className="font-mono text-mute">{r.costEstimateGbp ?? "—"}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
