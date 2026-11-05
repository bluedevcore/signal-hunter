# Build queue

Follows BRIEF.md § 7. Tick when done; mark the step in progress IN PROGRESS with notes.

- [x] 1. Scaffold: Next.js 15 + TypeScript + Tailwind 4, Drizzle schema + migrations (`drizzle/`), password login, `.env.example`
- [x] 2. Seed + CRM: in-app /setup (migrate + seed), Leads, listing view, activity logging, stages, Pipeline (drag and drop), Builds, Hunts (seeded runs), Call mode (/today), Settings. Call-script and build-brief buttons work when ANTHROPIC_API_KEY is set.
- [ ] 3. Inngest + Vercel Cron, pipeline stages 1–4 (Reed scan, filters, full description + responsibilities parser, hands-on check), dry run
- [ ] 4. Stage 5: Claude diagnosis (responsibilities, duty coverage, scores, problem, solution, opener) + `backfill` for the seeded jobs
- [ ] 5. Stages 6–8: Companies House, Apify, GetLeads, lead creation
- [ ] 6. Hunts page live counts + drop reasons, editable Settings
- [ ] 7. README costs section

Notes
- Local dev uses PGlite (embedded Postgres) in ./.pglite; never kill -9 a running dev server or the folder can corrupt (delete it and run `pnpm seed`).
- Seeded duty coverage exists only for Westone's Bid Writer (worked example); step 4's backfill fills the rest.
