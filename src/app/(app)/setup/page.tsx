import Link from "next/link";
import { dbReady } from "@/lib/queries";
import { setupDatabase } from "@/lib/actions";
import { SubmitButton } from "@/components/Pending";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const { done, error } = await searchParams;
  const ready = await dbReady();
  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="kicker">Setup</div>
        <h1 className="m-0 text-[44px] font-extrabold" style={{ letterSpacing: "-0.03em" }}>Database</h1>
      </header>
      <section className="card p-7 flex flex-col gap-4 max-w-[720px]">
        <p className="m-0 text-base leading-relaxed">
          {ready ? "The database is set up." : "The database is empty. This creates the tables and loads the seed data: 257 diagnosed jobs from the 5 Nov hunt, your 16 targets with contacts, the 6 tools and their demos."}
        </p>
        {error && <p className="m-0 px-4 py-3 rounded-[10px] text-sm break-words" style={{ background: "#F7E1DD", color: "#8A2414" }}><strong>Setup failed:</strong> {error}</p>}
        {done && <p className="m-0 px-4 py-3 rounded-[10px] text-sm" style={{ background: "#E3EFE2", color: "#1F5A2E" }}>{done}</p>}
        <form action={setupDatabase} className="flex flex-col gap-3">
          {ready && (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" name="reset" /> Wipe everything and reload the seed data (deletes your logged calls and stage changes)
            </label>
          )}
          <SubmitButton pendingText="Setting up…" className="btn btn-dark h-11 self-start">{ready ? "Run migrations / reseed" : "Set up database"}</SubmitButton>
        </form>
        {ready && <Link href="/" className="text-sm font-semibold text-accent">Go to leads →</Link>}
      </section>
    </>
  );
}
