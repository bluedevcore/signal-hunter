# Build queue

Follows BRIEF.md § 7. Tick when done; mark the step in progress IN PROGRESS with notes.

- [x] 1. Scaffold: Next.js 15 + TypeScript + Tailwind 4, Drizzle schema + migrations (`drizzle/`), password login, `.env.example`
- [x] 2. Seed + CRM: in-app /setup (migrate + seed), Leads, listing view, activity logging, stages, Pipeline (drag and drop), Builds, Hunts (seeded runs), Call mode (/today), Settings. Call-script and build-brief buttons work when ANTHROPIC_API_KEY is set.
- [x] 3. Pipeline engine (Postgres job queue + Vercel Cron + self-chaining ticks, no Inngest), stages 1–4: Reed scan, filters, full ad + responsibilities parser, hands-on check
- [x] 4. Stage 5: Claude diagnosis via tool use (responsibilities, duty coverage, scores, problem, evidence, solution, opener) + backfill for existing leads
- [x] 5. Stages 6–8: Companies House (size, directors as contacts, group flag), Apify Google Maps (phone, website), lead creation with sibling notes. GetLeads skipped: no public API key flow; add later if needed
- [x] 6. Hunts page: live progress, last-hunt funnel, drop reasons, run history with cost; Settings shows keys and rules (editing rules in-app: later)
- [ ] 7. README costs section

Notes
- Local dev uses PGlite (embedded Postgres) in ./.pglite; never kill -9 a running dev server or the folder can corrupt (delete it and run `pnpm seed`).
- Seeded duty coverage exists only for Westone's Bid Writer (worked example); step 4's backfill fills the rest.

- Pipeline: `src/lib/hunt/engine.ts`. Each tick does ~45s of work under a lease on the run row. Ticks come from the Hunts page while open, from each tick chaining the next one (needs CRON_SECRET + production URL), and from Vercel Cron (Mon 06:00 start, daily 07:30 safety tick).
- Test locally: `HUNT_MOCK_CLAUDE=1 HUNT_TEST_KEYWORDS="bid writer" REED_API_KEY=... pnpm hunt`
