# Signal Hunter

A private CRM for finding UK SMBs hiring for desk roles an AI tool can do, working out why they're hiring, and pitching the tool. See `BRIEF.md` for the full spec and `QUEUE.md` for build progress. Design: https://claude.ai/artifact/DPZCmK8LVm8WPgyCWA77y9

## Deploy on Vercel

1. vercel.com → Add New → Project → import `bluedevcore/signal-hunter`. Framework: Next.js (detected). Deploy.
2. Project → Storage → Create Database → Neon (Postgres) → connect to the project. This adds `DATABASE_URL`.
3. Project → Settings → Environment Variables: add `APP_PASSWORD`, `AUTH_SECRET` (long random string) and, optionally, `ANTHROPIC_API_KEY`.
4. Redeploy (Deployments → ⋯ → Redeploy).
5. Open the site, sign in, go to **/setup** and click **Set up database**. This creates the tables and loads the seed data.

## Run locally

```
pnpm install
pnpm seed        # creates ./.pglite and loads the seed data (add --reset to wipe)
pnpm dev         # http://localhost:3000, no login when APP_PASSWORD is unset
```

## Stack

Next.js 15 (App Router, server actions), Drizzle ORM on Neon (PGlite locally), Tailwind 4. The hunt pipeline (Inngest + Vercel Cron, Reed, Companies House, Apify, GetLeads, Claude) arrives in build steps 3–5.
