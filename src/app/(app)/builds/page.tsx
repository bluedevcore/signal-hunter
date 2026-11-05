import Link from "next/link";
import { redirect } from "next/navigation";
import { buildsData, dbReady } from "@/lib/queries";
import { DemoPill } from "@/components/ui";
import { CopyButton } from "@/components/Copy";
import { SubmitButton } from "@/components/Pending";
import { updateDemo } from "@/lib/actions";

export default async function BuildsPage() {
  if (!(await dbReady())) redirect("/setup");
  const { tools, demos } = await buildsData();
  return (
    <>
      <header className="flex flex-wrap gap-4 justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="kicker">Builds · {tools.length} tools, {demos.length} client demos</div>
          <h1 className="m-0 text-[44px] font-extrabold" style={{ letterSpacing: "-0.03em" }}>A few tools, many demos</h1>
          <p className="m-0 text-base text-mute max-w-[680px]">Each tool is built once and configured per client. A demo is a tool plus that client&apos;s sample data, a live link and a Loom.</p>
        </div>
        <a href="https://github.com/bluedevcore/trojan-horse-protocol" target="_blank" rel="noreferrer" className="btn btn-light">Demo repo ↗</a>
      </header>

      <section aria-label="Tools" className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {tools.map((t) => (
          <div key={t.id} className="card p-5 flex flex-col gap-2.5" style={{ borderRadius: 12 }}>
            <div className="flex justify-between items-center gap-3">
              <span className="font-mono text-[15px] font-semibold">{t.name}</span>
              <DemoPill status={t.status} />
            </div>
            <span className="text-sm text-ink-2 leading-normal">{t.description}</span>
            <span className="text-[13px] text-mute">{t.clients.join(" · ") || "No clients yet"}</span>
          </div>
        ))}
      </section>

      <section aria-label="Generate a demo" className="rounded-xl px-6 py-5 flex flex-wrap gap-4 items-center justify-between border border-dashed" style={{ borderColor: "#CFCBC2" }}>
        <div className="flex flex-col gap-1">
          <span className="label">Next phase</span>
          <span className="text-base font-semibold">Generate a demo from any lead</span>
          <span className="text-sm text-mute">Pick a lead, and its build brief goes to Claude Code, which builds, deploys and posts the link back here.</span>
        </div>
        <button className="btn btn-light" disabled>Generate demo · coming after v1</button>
      </section>

      <section className="card overflow-x-auto">
        <div style={{ minWidth: 1180 }}>
          <h2 className="m-0 px-6 pt-5 pb-2 text-xl font-bold">Client demos</h2>
          <div className="grid gap-3 px-6 py-3 border-b border-line label" style={{ gridTemplateColumns: "minmax(0,1fr) 140px 150px 230px 200px 190px" }}>
            <span>Client and role</span><span>Tool</span><span>Status</span><span>Live link</span><span>Loom</span><span>Build brief</span>
          </div>
          {demos.map((d) => (
            <form key={d.demo.id} action={updateDemo} className="grid gap-3 px-6 py-3 border-b border-line-soft text-sm items-center" style={{ gridTemplateColumns: "minmax(0,1fr) 140px 150px 230px 200px 190px" }}>
              <input type="hidden" name="id" value={d.demo.id} />
              <Link href={`/leads/${d.leadId}`} className="link-row flex flex-col gap-0.5 min-w-0">
                <span className="row-title font-semibold truncate">{d.company}</span>
                <span className="text-[13px] text-mute truncate">{d.role}</span>
              </Link>
              <span className="font-mono text-[13px]">{d.tool ?? "—"}</span>
              <select name="status" defaultValue={d.demo.status} className="field h-9 text-[13px]" aria-label="Status">
                <option value="queued">Queued</option><option value="in_progress">In progress</option><option value="built">Built</option><option value="live">Live</option>
              </select>
              <input name="liveUrl" defaultValue={d.demo.liveUrl ?? ""} placeholder="https://…" className="field h-9 text-[13px]" aria-label="Live link" />
              <input name="loomUrl" defaultValue={d.demo.loomUrl ?? ""} placeholder={d.demo.loomNote ?? "Loom link"} className="field h-9 text-[13px]" aria-label="Loom link" />
              <span className="flex gap-2 items-center">
                {d.demo.buildBrief || d.brief ? <CopyButton text={(d.demo.buildBrief || d.brief)!} label="Copy brief" /> : <Link href={`/leads/${d.leadId}`} className="text-[13px] text-mute hover:text-ink">No brief yet</Link>}
                <SubmitButton className="btn btn-light h-9 text-[13px]" pendingText="…">Save</SubmitButton>
              </span>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}
