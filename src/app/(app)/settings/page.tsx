import Link from "next/link";
import { claudeConfigured } from "@/lib/claude";
import { SETTINGS } from "@/lib/hunt/config";

const KEYS: [string, string, string][] = [
  ["DATABASE_URL", "Neon Postgres", "Added by the Vercel Neon integration"],
  ["APP_PASSWORD", "Login password", "Protects the app"],
  ["AUTH_SECRET", "Session signing", "Any long random string"],
  ["ANTHROPIC_API_KEY", "Claude", "Diagnosis, call scripts and build briefs"],
  ["REED_API_KEY", "Reed jobs API", "Weekly scan"],
  ["COMPANIES_HOUSE_API_KEY", "Companies House", "Company size and directors"],
  ["APIFY_TOKEN", "Apify Google Maps", "Phone and website from Google Maps"],
  ["CRON_SECRET", "Cron secret", "Lets the weekly hunt run by itself"],
];

export default function SettingsPage() {
  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="kicker">Settings</div>
        <h1 className="m-0 text-[44px] font-extrabold" style={{ letterSpacing: "-0.03em" }}>Keys and filters</h1>
      </header>
      <section className="card p-7 flex flex-col gap-1">
        <h2 className="m-0 mb-2 text-xl font-bold">Connections</h2>
        {KEYS.map(([k, name, note]) => {
          const set = k === "ANTHROPIC_API_KEY" ? claudeConfigured() : !!process.env[k];
          return (
            <div key={k} className="grid gap-4 py-3 border-t border-line-soft items-center text-sm" style={{ gridTemplateColumns: "240px minmax(0,1fr) 110px" }}>
              <span className="font-mono text-[13px]">{k}</span>
              <span><strong>{name}</strong> <span className="text-mute">· {note}</span></span>
              <span className="pill justify-self-end" style={set ? { background: "#E3EFE2", color: "#1F5A2E" } : { background: "#ECEAE4", color: "#3D3B36" }}>{set ? "Set" : "Not set"}</span>
            </div>
          );
        })}
        <p className="m-0 pt-3 text-[13px] text-mute">Set these in Vercel → Project → Settings → Environment Variables, then redeploy.</p>
      </section>
      <section className="card p-7 flex flex-col gap-2">
        <h2 className="m-0 text-xl font-bold">Hunt filters</h2>
        <p className="m-0 text-sm text-mute">{SETTINGS.keywords.length} Reed keywords · salary £{SETTINGS.salaryMin.toLocaleString("en-GB")}–£{SETTINGS.salaryMax.toLocaleString("en-GB")} · last {SETTINGS.daysBack} days · direct employers only · max {SETTINGS.maxOpeningsPerEmployer} openings per employer. Rules live in <code>src/lib/hunt/config.ts</code>.</p>
        <p className="m-0 text-[13px] text-mute leading-relaxed">{SETTINGS.keywords.join(" · ")}</p>
        <Link href="/setup" className="text-sm font-semibold text-accent">Database setup →</Link>
      </section>
    </>
  );
}
