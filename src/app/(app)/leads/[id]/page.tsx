import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { dbReady, leadDetail } from "@/lib/queries";
import { CoveragePill, EaseBars, ReplaceBar, Section, StagePill, DemoPill } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/AutoSubmit";
import { CopyButton } from "@/components/Copy";
import { SubmitButton } from "@/components/Pending";
import { setStageForm, logActivity, generateBuildBrief, generateCallScript } from "@/lib/actions";
import { STAGES } from "@/db/schema";
import { daysUntil, shortDate, dayLabel, today } from "@/lib/util";
import { claudeConfigured } from "@/lib/claude";

const OUTCOMES = [
  ["no_answer", "No answer"], ["voicemail", "Voicemail"], ["gatekeeper", "Gatekeeper"],
  ["spoke", "Spoke"], ["interested", "Interested"], ["meeting_booked", "Meeting booked"],
] as const;

function Fact({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 py-3.5" style={{ paddingLeft: first ? 28 : 20, paddingRight: 12, borderLeft: first ? undefined : "1px solid #EEECE6" }}>
      <dt className="label">{label}</dt>
      <dd className="m-0 text-[15px] font-semibold min-h-[22px] flex items-center">{children}</dd>
    </div>
  );
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dbReady())) redirect("/setup");
  const { id } = await params;
  const d = await leadDetail(Number(id));
  if (!d) notFound();
  const { lead, job, company, dx, people, timeline, siblings, demo } = d;
  const days = daysUntil(job.closesAt);
  const duties = dx?.dutyCoverage?.length ? dx.dutyCoverage : (job.responsibilities || []).map((duty) => ({ duty, coverage: null as null | string, how: "" }));
  const counts = { full: 0, partial: 0, none: 0 } as Record<string, number>;
  (dx?.dutyCoverage || []).forEach((c) => (counts[c.coverage] += 1));
  const ai = claudeConfigured();
  const phone = company.mainPhone || people.find((p) => p.phone)?.phone || null;
  const named = people.filter((p) => !p.name.startsWith("Ask for"));
  const overdue = lead.nextActionAt && lead.nextActionAt <= today();

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="text-sm text-mute"><Link href="/" className="hover:text-ink">Leads</Link> / <span className="text-ink">{company.name}</span></div>
        <div className="flex flex-wrap gap-2 items-center">
          <form action={setStageForm}>
            <input type="hidden" name="leadId" value={lead.id} />
            <label className="flex items-center gap-2 h-10 pl-3.5 pr-1 rounded-[10px] border border-line bg-white text-[13px] text-mute">Stage
              <AutoSubmitSelect name="stage" defaultValue={lead.stage} className="h-[38px] border-0 bg-transparent text-sm font-semibold px-2 text-ink">
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </AutoSubmitSelect>
            </label>
          </form>
          <a href={job.url} target="_blank" rel="noreferrer" className="btn btn-light">View ad ↗</a>
          <form action={generateBuildBrief}>
            <input type="hidden" name="leadId" value={lead.id} />
            <SubmitButton disabled={!ai} title={ai ? undefined : "Add ANTHROPIC_API_KEY to enable"} pendingText="Writing brief…">
              {dx?.buildBrief ? "Regenerate build brief" : "Generate build brief"}
            </SubmitButton>
          </form>
        </div>
      </div>

      <header className="card overflow-hidden">
        <div className="px-7 pt-6 pb-5 flex flex-col gap-2">
          <div className="kicker">Lead {String(lead.id).padStart(2, "0")} · found {shortDate(lead.createdAt)} · Reed</div>
          <h1 className="m-0 text-[34px] leading-tight font-extrabold" style={{ letterSpacing: "-0.025em" }}>{job.title}</h1>
          <p className="m-0 text-base text-mute"><strong className="text-ink font-semibold">{company.name}</strong> · {job.location}{company.website ? <> · <a href={company.website} className="underline">{company.domain || company.website}</a></> : null}</p>
        </div>
        <dl className="m-0 grid border-t border-line-soft" style={{ gridTemplateColumns: "repeat(6, minmax(0,1fr))" }}>
          <Fact label="Salary" first>{job.salaryText && job.salaryText !== "Not stated" ? job.salaryText : "Not stated"}</Fact>
          <Fact label="Stage"><StagePill stage={lead.stage} /></Fact>
          <Fact label="Closes">{shortDate(job.closesAt)}{days !== null && <span className="font-normal text-mute">&nbsp;· {days < 0 ? "closed" : `${days} days`}</span>}</Fact>
          <Fact label="Size">{company.sizeBand}</Fact>
          <Fact label="Desk fit"><span className="capitalize">{dx?.deskFit ?? "—"}</span></Fact>
          <Fact label="Ease of build"><EaseBars ease={dx?.easeOfBuild} size="lg" /></Fact>
        </dl>
      </header>

      <div className="flex flex-wrap gap-6 items-start">
        <div className="flex flex-col gap-6" style={{ flex: "999 1 560px", minWidth: 0 }}>
          <Section title="What they'll be doing" aside={duties.length ? `${duties.length} duties · ${job.responsibilitiesSource === "claude" ? "extracted by Claude" : "from the ad's responsibilities section"}` : undefined}>
            {duties.length === 0 && <p className="m-0 text-mute text-sm">No responsibilities section was found in this ad. The backfill step will extract them with Claude.</p>}
            <div className="flex flex-col">
              {duties.map((x, i) => (
                <div key={i} className="grid gap-3.5 py-3.5 border-t border-line-soft items-start" style={{ gridTemplateColumns: "28px minmax(0,1fr) 96px" }}>
                  <span className="font-mono text-[13px] text-mute pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex flex-col gap-1">
                    <span className="text-[15px] leading-relaxed">{x.duty}</span>
                    {x.how && <span className="text-[13px] text-mute">{x.how}</span>}
                  </span>
                  <span className="justify-self-end">{x.coverage ? <CoveragePill coverage={x.coverage} /> : null}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 pt-4 border-t border-line">
              <ReplaceBar replace={dx?.replaceScore} improve={dx?.improveScore} height={10} label={false} />
              <span className="text-sm text-ink-2">
                <strong>{dx?.replaceScore ?? "?"} replace · {dx?.improveScore ?? "?"} improve.</strong>{" "}
                {dx?.dutyCoverage?.length ? `${counts.full} duties fully covered, ${counts.partial} partly, ${counts.none} stay with their team.` : "Coverage per duty arrives with the Claude backfill."}
              </span>
            </div>
          </Section>

          <Section title="Why they're hiring">
            <p className="m-0 text-lg leading-normal">{dx?.problem}</p>
            {dx?.evidence && (
              <blockquote className="m-0 px-5 py-4 bg-page rounded-[10px] text-[15px] leading-relaxed text-ink-2">
                “{dx.evidence}”<span className="block mt-2 label">From the ad</span>
              </blockquote>
            )}
          </Section>

          <Section title="What we'd build" aside={demo ? <Link href="/builds" className="hover:text-ink">Tool: {demo.tool ?? "new"} · <DemoPill status={demo.status} /></Link> : "No demo yet"}>
            <p className="m-0 text-base leading-relaxed">{dx?.solution}</p>
            {dx?.buildBrief && (
              <details className="border border-line rounded-[10px]">
                <summary className="px-4 py-3 cursor-pointer text-sm font-semibold flex justify-between items-center">Build brief for Claude Code <CopyButton text={dx.buildBrief} label="Copy brief" /></summary>
                <pre className="m-0 px-4 pb-4 whitespace-pre-wrap text-[13px] leading-relaxed font-mono text-ink-2">{dx.buildBrief}</pre>
              </details>
            )}
          </Section>

          {siblings.length > 0 && (
            <Section title={`Also hiring at ${company.name}`} aside="Separate leads · same contacts">
              {siblings.map((s) => (
                <Link key={s.id} href={`/leads/${s.id}`} className="link-row grid gap-4 items-center px-4 py-3.5 rounded-[10px] border border-line" style={{ gridTemplateColumns: "minmax(0,1fr) 100px 80px 130px 110px" }}>
                  <span className="flex flex-col gap-0.5 min-w-0"><span className="row-title font-semibold truncate">{s.role}</span><span className="text-[13px] text-mute truncate">{s.problem}</span></span>
                  <span className="font-mono text-sm">{s.salaryText && s.salaryText !== "Not stated" ? s.salaryText : "—"}</span>
                  <EaseBars ease={s.ease} size="sm" />
                  <span className="text-xs text-mute"><strong className="text-ink">{s.replace}</strong> replace · {s.improve} improve</span>
                  <StagePill stage={s.stage} />
                </Link>
              ))}
            </Section>
          )}
        </div>

        <aside className="flex flex-col gap-6" style={{ flex: "1 1 340px", minWidth: 0 }}>
          <section className="card p-6 flex flex-col gap-3.5">
            <h2 className="m-0 text-lg font-bold">Call</h2>
            {phone ? (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex justify-between items-center h-[52px] px-4 rounded-[10px] bg-ink text-white font-semibold">
                <span>Main line</span><span className="font-mono">{phone}</span>
              </a>
            ) : <p className="m-0 text-sm text-mute">No phone number yet. Enrichment adds one in build step 5.</p>}
            {dx?.callOpener && (
              <div className="flex flex-col gap-1.5">
                <span className="label">Opener</span>
                <p className="m-0 text-[15px] leading-relaxed">“{dx.callOpener}”</p>
              </div>
            )}
            {dx?.callScript && (
              <details className="border border-line rounded-[10px]">
                <summary className="px-4 py-3 cursor-pointer text-sm font-semibold">60-second script</summary>
                <pre className="m-0 px-4 pb-4 whitespace-pre-wrap text-[13px] leading-relaxed font-sans text-ink-2">{dx.callScript}</pre>
              </details>
            )}
            <form action={generateCallScript}>
              <input type="hidden" name="leadId" value={lead.id} />
              <SubmitButton className="btn btn-light w-full h-11" disabled={!ai} title={ai ? undefined : "Add ANTHROPIC_API_KEY to enable"} pendingText="Writing script…">
                {dx?.callScript ? "Regenerate call script" : "Generate 60-second script"}
              </SubmitButton>
            </form>
          </section>

          <section className="card p-6 flex flex-col gap-1">
            <h2 className="m-0 mb-2.5 text-lg font-bold">People</h2>
            {people.length === 0 && <p className="m-0 text-sm text-mute">No contacts yet.</p>}
            {people.map((p) => (
              <div key={p.id} className="flex justify-between gap-3 items-center py-3 border-t border-line-soft">
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-[13px] text-mute">{p.title}{p.email ? ` · ${p.email}` : ""}{p.emailStatus === "verified" ? " ✓" : ""}</span>
                </span>
                <span className="flex gap-1.5 shrink-0">
                  {p.phone && <a href={`tel:${p.phone.replace(/\s/g, "")}`} aria-label={`Call ${p.name}`} className="w-11 h-11 rounded-[10px] border border-line flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1A17" strokeWidth="2" aria-hidden><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg></a>}
                  {p.email && <a href={`mailto:${p.email}`} aria-label={`Email ${p.name}`} className="w-11 h-11 rounded-[10px] border border-line flex items-center justify-center text-[13px] font-bold">@</a>}
                  {p.linkedin && <a href={p.linkedin.startsWith("http") ? p.linkedin : `https://${p.linkedin}`} target="_blank" rel="noreferrer" aria-label={`${p.name} on LinkedIn`} className="w-11 h-11 rounded-[10px] border border-line flex items-center justify-center text-[13px] font-bold">in</a>}
                </span>
              </div>
            ))}
            {people.some((p) => p.notes) && <p className="m-0 pt-3 border-t border-line-soft text-[13px] text-mute leading-relaxed">{people.find((p) => p.notes)?.notes}</p>}
          </section>

          <section className="card p-6 flex flex-col gap-3.5">
            <h2 className="m-0 text-lg font-bold">Next action</h2>
            {lead.nextAction ? (
              <div className="flex justify-between items-center gap-3">
                <span className="text-[15px]">{lead.nextAction}</span>
                {lead.nextActionAt && <span className="font-mono text-[13px] font-semibold" style={{ color: overdue ? "#B4321F" : "#5F5C55" }}>{dayLabel(lead.nextActionAt)}</span>}
              </div>
            ) : <p className="m-0 text-sm text-mute">None set.</p>}
          </section>

          <section className="card p-6 flex flex-col gap-3.5">
            <h2 className="m-0 text-lg font-bold">Log activity</h2>
            <form action={logActivity} className="flex flex-col gap-3.5">
              <input type="hidden" name="leadId" value={lead.id} />
              <label className="text-[13px] text-mute flex flex-col gap-1.5">Type
                <select name="type" className="field" defaultValue="call">
                  <option value="call">Call</option><option value="email">Email</option><option value="linkedin">LinkedIn</option><option value="note">Note</option><option value="demo">Demo</option><option value="proposal">Proposal</option>
                </select>
              </label>
              <fieldset className="border-0 p-0 m-0 flex flex-wrap gap-1.5">
                <legend className="sr-only">Outcome</legend>
                {OUTCOMES.map(([v, l]) => (
                  <label key={v} className="chip cursor-pointer has-checked:bg-ink has-checked:text-white has-checked:border-ink">
                    <input type="radio" name="outcome" value={v} className="sr-only" />{l}
                  </label>
                ))}
              </fieldset>
              <label className="text-[13px] text-mute flex flex-col gap-1.5">Note
                <textarea name="body" rows={3} placeholder="What did they say?" className="field resize-y" />
              </label>
              <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(0,1fr) 150px" }}>
                <label className="text-[13px] text-mute flex flex-col gap-1.5">Next action
                  <input name="nextAction" defaultValue={lead.nextAction ?? ""} className="field" />
                </label>
                <label className="text-[13px] text-mute flex flex-col gap-1.5">Due
                  <input name="nextActionAt" type="date" defaultValue={lead.nextActionAt ?? ""} className="field" />
                </label>
              </div>
              <SubmitButton className="btn btn-dark h-11" pendingText="Saving…">Save to timeline</SubmitButton>
            </form>
            <div className="flex flex-col gap-3 pt-2 border-t border-line-soft">
              {timeline.map((a) => (
                <div key={a.id} className="grid gap-2.5 text-[13px]" style={{ gridTemplateColumns: "56px minmax(0,1fr)" }}>
                  <span className="font-mono text-mute">{shortDate(a.createdAt)}</span>
                  <span>
                    {a.type !== "system" && <strong className="capitalize">{a.type}{a.outcome && a.outcome !== "other" ? ` · ${a.outcome.replace("_", " ")}` : ""}. </strong>}
                    {a.body}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
