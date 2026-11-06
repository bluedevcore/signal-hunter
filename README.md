# Signal Hunter

A private CRM for finding UK SMBs hiring for desk roles an AI tool can do, working out why they're hiring, and pitching the tool. See `BRIEF.md` for the full spec and `QUEUE.md` for build progress. Design: https://claude.ai/artifact/DPZCmK8LVm8WPgyCWA77y9

## Deploy on Vercel

1. vercel.com → Add New → Project → import `bluedevcore/signal-hunter`. Framework: Next.js (detected). Deploy.
2. Database, either:
   - **Supabase:** create a project at supabase.com → Connect → copy the **Transaction pooler** URI (port 6543), put your database password in it, and add it in Vercel as `DATABASE_URL`.
   - **Neon:** Project → Storage → Create Database → Neon, which adds `DATABASE_URL` for you.
3. Project → Settings → Environment Variables: add `APP_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET` (long random strings), `ANTHROPIC_API_KEY`, `REED_API_KEY`, `COMPANIES_HOUSE_API_KEY`, `APIFY_TOKEN`.
4. Redeploy (Deployments → ⋯ → Redeploy).
5. Open the site, sign in, go to **/setup** and click **Set up database**. This creates the tables and loads the seed data.

## Run locally

```
pnpm install
pnpm seed        # creates ./.pglite and loads the seed data (add --reset to wipe)
pnpm dev         # http://localhost:3000, no login when APP_PASSWORD is unset
```

## Stack

Next.js 15 (App Router, server actions), Drizzle ORM on Neon (PGlite locally), Tailwind 4. The hunt runs as a job queue in Postgres, advanced by short ticks (Vercel Cron, self-chaining, or the Hunts page): Reed → filters → full ad + responsibilities → Claude diagnosis → Companies House → Apify Google Maps → leads. A full weekly hunt costs roughly £2–5 in Claude usage plus Apify results.

## Run a hunt

Hunts → **Run hunt now** (or wait for Monday 06:00). Hunts → **Backfill N leads with Claude** fills duties, coverage and scores for the seeded leads.
