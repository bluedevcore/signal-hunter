import Link from "next/link";
import { redirect } from "next/navigation";
import { allLeads, dbReady, diagnosedCount } from "@/lib/queries";
import { EaseBars, ReplaceBar, StagePill, StatStrip } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/AutoSubmit";
import { daysUntil, shortDate } from "@/lib/util";
import { STAGES } from "@/db/schema";

type SP = Record<string, string | undefined>;

const TOGGLES = [
  { key: "fit", on: "strong", label: "Strong fit", defaultOn: true },
  { key: "easy", on: "1", label: "Easy builds (4–5)" },
  { key: "sme", on: "1", label: "SMB + Mid-size" },
  { key: "soon", on: "1", label: "Closes in 14 days" },
  { key: "phone", on: "1", label: "Has phone" },
];

function isOn(sp: SP, t: (typeof TOGGLES)[number]) {
  const v = sp[t.key];
  if (v === undefined) return !!t.defaultOn;
  return v === t.on;
}

function hrefWith(sp: SP, key: string, value: string | null) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v !== undefined && k !== "limit") p.set(k, v);
  if (value === null) p.delete(key);
  else p.set(key, value);
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await dbReady())) redirect("/setup");
  const sp = await searchParams;
  const [all, diagnosed] = await Promise.all([allLeads(), diagnosedCount()]);
  const q = (sp.q || "").toLowerCase().trim();
  const stage = sp.stage || "";
  const sort = sp.sort || "ease";
  const limit = Math.max(25, Number(sp.limit) || 50);

  let rows = all.filter((l) => {
    if (isOn(sp, TOGGLES[0]) && l.deskFit !== "strong") return false;
    if (isOn(sp, TOGGLES[1]) && (l.ease ?? 0) < 4) return false;
    if (isOn(sp, TOGGLES[2]) && !["SMB", "Mid-size"].includes(l.size)) return false;
    if (isOn(sp, TOGGLES[3])) { const d = daysUntil(l.closesAt); if (d === null || d < 0 || d > 14) return false; }
    if (isOn(sp, TOGGLES[4]) && !l.hasPhone) return false;
    if (stage && l.stage !== stage) return false;
    if (q) {
      const hay = [l.role, l.company, l.location, l.problem, ...(l.responsibilities || [])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sorters: Record<string, (a: typeof rows[number], b: typeof rows[number]) => number> = {
    ease: (a, b) => (b.ease ?? 0) - (a.ease ?? 0) || (b.score ?? 0) - (a.score ?? 0),
    replace: (a, b) => (b.replace ?? 0) - (a.replace ?? 0) || (b.ease ?? 0) - (a.ease ?? 0),
    closing: (a, b) => (a.closesAt || "9999") < (b.closesAt || "9999") ? -1 : 1,
    salary: (a, b) => (b.salaryMax ?? 0) - (a.salaryMax ?? 0),
  };
  rows = rows.sort(sorters[sort] || sorters.ease);

  const strong = all.filter((l) => l.deskFit === "strong");
  const easy = strong.filter((l) => (l.ease ?? 0) >= 4);
  const smb = strong.filter((l) => l.size === "SMB");
  const inPipe = all.filter((l) => l.stage !== "New");
  const contacted = inPipe.filter((l) => !["Researched"].includes(l.stage)).length;
  const base = Math.max(1, strong.length);

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <form action="/" className="flex-1" style={{ flexBasis: 320, maxWidth: 520 }}>
          {Object.entries(sp).filter(([k]) => !["q", "limit"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className="flex items-center gap-2.5 bg-white border border-line rounded-[10px] px-3.5 h-11">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5F5C55" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <span className="sr-only">Search leads</span>
            <input name="q" type="search" defaultValue={sp.q} placeholder="Search company, role or duty…" className="border-0 outline-none bg-transparent text-sm w-full" />
          </label>
        </form>
        <Link href="/hunts" className="btn btn-dark h-11">Run hunt</Link>
      </div>

      <h1 className="kicker m-0">Leads · {all.length} in the CRM</h1>

      <StatStrip cells={[
        { label: "Strong desk fit", value: strong.length, note: `of ${diagnosed} diagnosed`, pct: (strong.length / Math.max(1, diagnosed)) * 100 },
        { label: "Easiest builds", value: easy.length, note: `ease 5: ${strong.filter((l) => l.ease === 5).length} · 4: ${strong.filter((l) => l.ease === 4).length}`, pct: (easy.length / base) * 100 },
        { label: "SMBs", value: smb.length, note: "owner one call away", pct: (smb.length / base) * 100 },
        { label: "In pipeline", value: inPipe.length, note: `${contacted} contacted · ${inPipe.length - contacted} researched`, pct: (inPipe.length / base) * 100, accent: true },
      ]} />

      <section aria-label="Filters" className="flex flex-wrap gap-2 items-center">
        {TOGGLES.map((t) => {
          const on = isOn(sp, t);
          return (
            <Link key={t.key} href={hrefWith(sp, t.key, on ? (t.defaultOn ? "all" : null) : t.on)} className={`chip ${on ? "chip-on" : ""}`} aria-pressed={on}>
              {t.label}
            </Link>
          );
        })}
        <span className="flex-auto" />
        <form action="/" className="flex gap-2 items-center">
          {Object.entries(sp).filter(([k]) => !["stage", "sort", "limit"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className="text-[13px] text-mute flex gap-2 items-center">Stage
            <AutoSubmitSelect name="stage" defaultValue={stage} className="field h-9 text-[13px]">
              <option value="">Any</option>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </AutoSubmitSelect>
          </label>
          <label className="text-[13px] text-mute flex gap-2 items-center">Sort
            <AutoSubmitSelect name="sort" defaultValue={sort} className="field h-9 text-[13px]">
              <option value="ease">Ease of build, easiest first</option>
              <option value="replace">Replace score, highest first</option>
              <option value="closing">Closing soonest</option>
              <option value="salary">Salary, highest first</option>
            </AutoSubmitSelect>
          </label>
          <noscript><button className="btn btn-light h-9">Apply</button></noscript>
        </form>
      </section>

      <section aria-label="Leads" className="card overflow-x-auto">
        <div style={{ minWidth: 980 }}>
          <div className="grid gap-4 px-6 py-3.5 border-b border-line label" style={{ gridTemplateColumns: "48px minmax(0,1fr) 110px 100px 112px 150px 120px" }}>
            <span>#</span><span>The role</span><span>Salary</span><span>Closes</span><span>Ease of build</span><span>Replace / improve</span><span>Stage</span>
          </div>
          {rows.slice(0, limit).map((r, i) => {
            const d = daysUntil(r.closesAt);
            const closeIn = d === null ? "Rolling" : d < 0 ? "Closed" : d === 0 ? "Today" : d === 1 ? "Tomorrow" : `${d} days`;
            return (
              <Link key={r.id} href={`/leads/${r.id}`} className="link-row grid gap-4 px-6 py-2.5 border-b border-line-soft items-center" style={{ gridTemplateColumns: "48px minmax(0,1fr) 110px 100px 112px 150px 120px" }}>
                <span className="font-mono text-[13px] text-mute">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="row-title text-[15px] font-semibold truncate tracking-tight">
                    {r.role} <span className="font-normal text-mute">· {r.company} · {r.location} · {r.size}</span>
                  </span>
                  <span className="text-[13px] text-ink-2 truncate">{r.problem}</span>
                </span>
                <span className="font-mono text-sm">{r.salaryText && r.salaryText !== "Not stated" ? r.salaryText : "—"}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold" style={{ color: d !== null && d <= 3 ? "#B4321F" : undefined }}>{closeIn}</span>
                  <span className="text-xs text-mute">{shortDate(r.closesAt)}</span>
                </span>
                <span><EaseBars ease={r.ease} /></span>
                <ReplaceBar replace={r.replace} improve={r.improve} />
                <span><StagePill stage={r.stage} /></span>
              </Link>
            );
          })}
          {rows.length === 0 && <div className="px-6 py-10 text-center text-mute">No leads match these filters.</div>}
          <div className="flex justify-between items-center px-6 py-4 text-sm text-mute">
            <span>Showing {Math.min(limit, rows.length)} of {rows.length}</span>
            {rows.length > limit && <Link href={`${hrefWith(sp, "limit", String(limit + 50))}`} className="btn btn-light">Load more</Link>}
          </div>
        </div>
      </section>
    </>
  );
}
