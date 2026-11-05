import { redirect } from "next/navigation";
import { allLeads, dbReady } from "@/lib/queries";
import { Board, type Card } from "@/components/Board";
import { StatStrip, STAGE_DOT } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/AutoSubmit";
import { today } from "@/lib/util";

const COLS = ["New", "Researched", "Contacted", "Conversation", "Demo sent", "Proposal", "Won"];

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await dbReady())) redirect("/setup");
  const sp = await searchParams;
  const show = sp.show || "strong";
  const sort = sp.sort || "due";
  const t = today();
  let leads = await allLeads();
  if (show === "strong") leads = leads.filter((l) => l.deskFit === "strong");
  const sorters: Record<string, (a: typeof leads[number], b: typeof leads[number]) => number> = {
    due: (a, b) => (a.nextActionAt || "9999") < (b.nextActionAt || "9999") ? -1 : (a.nextActionAt || "9999") > (b.nextActionAt || "9999") ? 1 : (b.score ?? 0) - (a.score ?? 0),
    ease: (a, b) => (b.ease ?? 0) - (a.ease ?? 0) || (b.score ?? 0) - (a.score ?? 0),
    salary: (a, b) => (b.salaryMax ?? 0) - (a.salaryMax ?? 0),
  };
  leads.sort(sorters[sort] || sorters.due);
  const cards: Card[] = leads.map((l) => ({
    id: l.id, stage: l.stage, company: l.company, role: l.role,
    salary: l.salaryText && l.salaryText !== "Not stated" ? l.salaryText : "—",
    ease: l.ease, next: l.nextAction, due: !!(l.nextActionAt && l.nextActionAt <= t), tool: l.demo?.tool ?? null,
  }));

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h1 className="kicker m-0">Pipeline · one card per job ad</h1>
        <form className="flex gap-2 items-center">
          <label className="flex items-center gap-2 h-10 pl-3.5 pr-1 rounded-[10px] border border-line bg-white text-[13px] text-mute">Show
            <AutoSubmitSelect name="show" defaultValue={show} className="h-[38px] border-0 bg-transparent text-sm font-semibold px-2 text-ink">
              <option value="strong">Strong fit only</option><option value="all">All leads</option>
            </AutoSubmitSelect>
          </label>
          <label className="flex items-center gap-2 h-10 pl-3.5 pr-1 rounded-[10px] border border-line bg-white text-[13px] text-mute">Sort
            <AutoSubmitSelect name="sort" defaultValue={sort} className="h-[38px] border-0 bg-transparent text-sm font-semibold px-2 text-ink">
              <option value="due">Next action due</option><option value="ease">Ease of build</option><option value="salary">Salary</option>
            </AutoSubmitSelect>
          </label>
        </form>
      </div>
      <StatStrip cells={COLS.map((c) => ({ label: c, value: cards.filter((k) => k.stage === c).length, dot: STAGE_DOT[c] }))} />
      <Board cols={COLS.map((c) => ({ name: c, dot: STAGE_DOT[c] }))} cards={cards} />
      <p className="m-0 text-[13px] text-mute">Drag a card to change its stage. Every move is logged on the lead. Lost and Not now are set from the lead page.</p>
    </>
  );
}
