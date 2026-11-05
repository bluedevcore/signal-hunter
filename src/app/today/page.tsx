import Link from "next/link";
import { redirect } from "next/navigation";
import { callQueue, dbReady } from "@/lib/queries";
import { logActivity } from "@/lib/actions";
import { SubmitButton } from "@/components/Pending";

export const dynamic = "force-dynamic";

const OUTCOMES = [
  ["no_answer", "No answer"], ["voicemail", "Voicemail"], ["gatekeeper", "Gatekeeper"],
  ["spoke", "Spoke"], ["interested", "Interested"], ["meeting_booked", "Meeting booked"],
] as const;

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  if (!(await dbReady())) redirect("/setup");
  const { queue, dueCount, people } = await callQueue();
  const i = Math.min(Math.max(0, Number((await searchParams).i) || 0), Math.max(0, queue.length - 1));
  const lead = queue[i];

  return (
    <div className="min-h-screen flex justify-center bg-page">
      <div className="w-full max-w-[440px] box-border px-[18px] py-5 flex flex-col gap-3.5">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-sm text-mute">← Leads</Link>
          <span className="font-mono text-xs font-semibold text-accent">{queue.length ? `CALL ${i + 1} OF ${queue.length}` : "NO CALLS"}{dueCount ? ` · ${dueCount} DUE` : ""}</span>
        </div>
        {!lead ? (
          <p className="text-mute">Nothing to call. Leads appear here when a next action is due or they reach Researched.</p>
        ) : (() => {
          const ppl = people.filter((p) => p.companyId === lead.companyId);
          const named = ppl.find((p) => !p.name.startsWith("Ask for"));
          const ask = named ? `Ask for ${named.name}${named.title ? `, ${named.title}` : ""}` : ppl[0]?.name ?? "Ask for the owner or manager";
          const phone = lead.mainPhone || ppl.find((p) => p.phone)?.phone;
          const nextHref = `/today?i=${i + 1 < queue.length ? i + 1 : 0}`;
          return (
            <>
              <div className="flex flex-col gap-1">
                <h1 className="m-0 text-[26px] font-extrabold" style={{ letterSpacing: "-0.02em" }}>{lead.company}</h1>
                <span className="text-sm text-mute">{ask}</span>
                <Link href={`/leads/${lead.id}`} className="text-[13px] text-mute underline">{lead.role}{lead.salaryText && lead.salaryText !== "Not stated" ? ` · ${lead.salaryText}` : ""}</Link>
              </div>
              {phone ? (
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="h-[60px] rounded-[14px] bg-ink text-white flex items-center justify-center gap-2.5 text-[17px] font-bold">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
                  {phone}
                </a>
              ) : <p className="m-0 text-sm text-mute">No phone number on file.</p>}
              <section className="card p-4 flex flex-col gap-2" style={{ borderRadius: 14 }}>
                <span className="label">Say this</span>
                <p className="m-0 text-[15px] leading-normal">{lead.problem ? `“I saw you're hiring a ${lead.role.toLowerCase()}. ${lead.problem} I've built a tool that takes a big chunk of that work off your team. Could I show you in ten minutes?”` : "Introduce the tool and ask for ten minutes."}</p>
                {lead.nextAction && <span className="text-[13px] text-mute">Next action: {lead.nextAction}</span>}
              </section>
              <form action={logActivity} className="flex flex-col gap-3.5">
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="type" value="call" />
                <input type="hidden" name="redirect" value={nextHref} />
                <fieldset className="border-0 p-0 m-0 grid grid-cols-2 gap-2">
                  <legend className="sr-only">Outcome</legend>
                  {OUTCOMES.map(([v, l]) => (
                    <label key={v} className="h-12 rounded-xl border border-line bg-white text-sm font-semibold flex items-center justify-center cursor-pointer text-ink-2 has-checked:bg-ink has-checked:text-white has-checked:border-ink">
                      <input type="radio" name="outcome" value={v} className="sr-only" required />{l}
                    </label>
                  ))}
                </fieldset>
                <label className="flex flex-col gap-1.5 text-[13px] text-mute">Note
                  <textarea name="body" rows={3} placeholder="What did they say?" className="field text-[15px] rounded-xl resize-none" />
                </label>
                <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(0,1fr) 140px" }}>
                  <label className="flex flex-col gap-1.5 text-[13px] text-mute">Next action
                    <input name="nextAction" defaultValue={lead.nextAction ?? ""} className="field h-12 text-[15px] rounded-xl" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] text-mute">Due
                    <input name="nextActionAt" type="date" className="field h-12 text-[15px] rounded-xl" />
                  </label>
                </div>
                <SubmitButton className="h-14 rounded-[14px] border-0 bg-accent text-white text-base font-bold cursor-pointer" pendingText="Saving…">Save and next lead →</SubmitButton>
              </form>
              <Link href={nextHref} className="text-center text-sm text-mute">Skip</Link>
            </>
          );
        })()}
      </div>
    </div>
  );
}
