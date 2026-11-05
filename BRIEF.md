# Signal Hunter: build brief

A private web app (a CRM for one user) that finds UK SMBs hiring for desk roles an AI agent can do, diagnoses the problem behind each hire, finds a decision maker and phone number, and lets me work the leads through to a closed deal.

Owner: Josh Bluemink. Single user. Deployed on Vercel.

---

## 1. What it does

1. **Hunt (weekly + on demand).** Scan job ads → filter → check the company → diagnose with Claude → enrich with contacts → save as leads.
2. **Work the leads.** A table and a pipeline board. Each lead shows the problem, the AI solution, the evidence from the ad, the contacts with click-to-call, and a log of every call, email and note.
3. **Track the run.** Each hunt records how many jobs survived each stage and what it cost.

---

## 2. Stack

- Next.js (App Router) + TypeScript, deployed on Vercel
- Postgres on Neon (via the Vercel integration) + Drizzle ORM and migrations
- Inngest for the pipeline (each stage is a step; retries and concurrency limits per API)
- Vercel Cron: Mondays 06:00 Europe/London triggers the hunt
- Anthropic SDK (model from `CLAUDE_MODEL`, default `claude-sonnet-5-5`)
- Tailwind + shadcn/ui
- Auth: single user. Use Auth.js with email magic link restricted to `ALLOWED_EMAIL`, or a password from env with a signed session cookie. Every page and API route requires it, except the Inngest and cron endpoints, which are verified by their own signing secrets.

### Environment variables

```
DATABASE_URL
ANTHROPIC_API_KEY
CLAUDE_MODEL=claude-sonnet-5-5
REED_API_KEY
COMPANIES_HOUSE_API_KEY
APIFY_TOKEN
GETLEADS_API_KEY            # optional; skip the step if missing
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
CRON_SECRET
ALLOWED_EMAIL
AUTH_SECRET
```

Put all of them in `.env.example` with a comment each. Never log secrets.

---

## 3. Data model (Drizzle)

- **runs**: id, started_at, finished_at, trigger (cron | manual), status, counts JSON per stage (scanned, after_noise, after_desk, strong, sme, diagnosed, enriched, new_leads), cost_estimate_gbp, error
- **jobs**: id, source ('reed'), source_job_id (unique per source), title, company_name, location, salary_min, salary_max, posted_at, closes_at, url, description_html (raw), description (plain text), **responsibilities (text[])**, **responsibilities_source (section | claude)**, **requirements (text[]: skills, systems, experience)**, run_id, filter_status (kept | dropped), drop_reason
- **companies**: id, name, normalised_name (unique), ch_number, ch_status, accounts_type, size_band (micro | small | medium | large | unknown), directors JSON, registered_address, website, domain, main_phone, is_group (bool), notes
- **diagnoses**: id, job_id (unique), desk_fit (strong | partial | poor), build_difficulty (1–5), replace_score (0–10), improve_score (= 10 − replace), problem, evidence (quote from the ad), solution, **duty_coverage (jsonb: [{duty, coverage: full | partial | none, how}])**, systems (text[]), call_opener, **build_brief (text, nullable)**, model, created_at
- **contacts**: id, company_id, name, title, email, email_status (verified | unverified | unknown), phone, linkedin, source (getleads | companies_house | apify | manual), notes
- **leads**: id, job_id (unique), company_id, stage, stage_changed_at, next_action, next_action_at, est_value_gbp_month, score, archived (bool). **One lead per job ad.** Leads at the same company share that company's contacts and link to each other ("Also hiring at …").
- **tools**: id, name (data_validation, bookkeeping, compliance, listings, leasehold_packs, bid_writer, …), status (queued | in_progress | built | live), description, repo_path
- **demos**: id, lead_id, tool_id, status (queued | in_progress | built | live), live_url, loom_url, build_brief, notes, updated_at
- **activities**: id, lead_id, contact_id (nullable), type (call | email | linkedin | note | demo | proposal), outcome (no_answer | voicemail | spoke | interested | not_interested | meeting_booked | other), body, created_at
- **settings**: single row: keyword lists, salary_min (18000), salary_max (100000), days_back (7), regex lists for agencies/public/big brands/scams, production-role allowlist

**Stages:** New → Researched → Contacted → Conversation → Demo sent → Proposal → Won | Lost | Not now.

---

## 4. The hunt pipeline (Inngest function `hunt.run`)

Run each stage as its own step. Store progress on the `runs` row so the Runs page can show live counts.

1. **Scan.** Use the Reed API (`/api/1.0/search`, Basic auth with the key as username and a blank password).
   - Loop over every keyword in settings with `postedByDirectEmployer=true`, paginating with `resultsToTake=100` and `resultsToSkip`.
   - Keep jobs posted within `days_back`.
   - Upsert into jobs by `source_job_id`, so re-runs never duplicate.
   - Throttle to stay polite (about 2 requests a second).

2. **Noise filter.** Use regex lists held in settings.
   - Drop recruitment agencies, the public sector (NHS, councils, universities, schools, police, government), big brands / plc / "group", and scams.
   - Drop any company with more than 6 openings in the run.
   - Drop jobs whose salary is outside the min–max range. Keep jobs with no salary stated.
   - Drop titles that aren't desk roles.
   - Drop titles containing head of / director / principal / chief / partner / engineer / developer / clinical.
   - Drop titles containing manager / senior / lead **unless** the title also matches the production-role allowlist: bid, tender, proposal, accountant, reporting, insight, paralegal, legal, marketing, content, seo, ecommerce, payroll, compliance, estimator, paraplanner, document control, claims, analyst, crm, bookkeep.
   - Record a `drop_reason` on every dropped job.

3. **Full description + responsibilities (critical).** Fetch `/api/1.0/jobs/{id}` for each surviving job. Store the raw HTML, the plain text and the closing date.

   The responsibilities section is what the tool gets built from, so treat this extraction as a core feature.

   Parse the section **from the HTML, before stripping it**, so the `<li>` items stay as separate duties:
   - **Start headings:** a short line, or a `<strong>`/`<b>`/`<h*>`/`<p>` on its own, matching any of:
     - What you'll be doing / What you will do
     - Key responsibilities / Key duties / Main duties
     - Your responsibilities / Duties include
     - Day to day / Day-to-day
     - The role involves / In this role you will / You will be responsible for
     - Role responsibilities / Key accountabilities
   - **Stop headings:** any of:
     - What we're looking for / About you / Who you are
     - Requirements / Skills / Experience / Essential / Desirable
     - You'll need / You'll bring / Person specification / Qualifications
     - Benefits / What we offer / In return / Why join
     - About us / How to apply
   - **Duties:** the list items (or lines) between the two headings.
     - Remove benefit lines (pension, holiday, bonus, discounts, parking and similar).
     - Keep the ad's wording.
     - Cap at 20 items.
   - **Requirements:** parse the section under the requirements / skills headings the same way, into `requirements`.
   - Set `responsibilities_source = section` when at least 3 duties were found. Otherwise leave it empty for Claude to fill in step 5.

   On the 5 Nov sample this parser found a clean list in about 70% of ads. Write unit tests using real ad HTML fixtures, covering bullets, a bold heading followed by a paragraph, and a heading with no list.

4. **Physical / people check.** Use a cheap regex score: driving, warehouse, site visits, filming, reception, care, front of house and similar. Drop jobs that are clearly hands-on before spending anything on Claude.

5. **Diagnose with Claude.** Use tool use or JSON output with a strict schema, in batches with concurrency 5. Give Claude the parsed responsibilities (if any), the requirements and the full ad text. Fields:
   - `responsibilities`: the clean list of what the person will actually do day to day, 5–15 items.
     - Stay close to the ad's wording.
     - One task per item.
     - No company blurb, person spec or benefits.
     - If the parser found a list, tidy it (split combined items, drop fluff) rather than rewriting it.
     - If it didn't, pull the duties out of the prose.

     Save to `jobs.responsibilities`, with `responsibilities_source = claude` when the parser had nothing.
   - `duty_coverage`: one entry per responsibility, `{duty, coverage: full | partial | none, how}`. `how` is a few words on what the tool does for that duty. This is the evidence behind `replace_score`.
   - `desk_fit`: strong = on a computer most of the day producing work; partial = mixed; poor = mostly people or physical
   - `build_difficulty` 1–5:
     - 1: standalone, documents in → text out
     - 2: one file or form in → one spreadsheet or system out
     - 3: connects to their accounting / CRM / ops software
     - 4: several systems plus people in the loop
     - 5: unclear or mixed
   - `replace_score` 0–10: how much of the role a tool could do outright, based on `duty_coverage` (full counts 1, partial 0.5, weighted by how much of the week each duty likely takes). Improve is 10 minus this. Be conservative: almost nothing is above 7.
   - `problem`: one line on **why** they're hiring (growth, manual process, backlog, new system, nobody owns it). Not a list of duties.
   - `evidence`: a short exact quote from the ad that shows the problem
   - `solution`: 2–3 sentences on what the AI tool does, built around the responsibilities with `full` or `partial` coverage
   - `systems`: systems named in the ad
   - `call_opener`: one sentence I can say on the phone

   Keep only `desk_fit = strong` for lead creation. Store all diagnoses.

6. **Company check.** Use the Companies House API (`/search/companies?q=`, then `/company/{n}` and `/company/{n}/officers`).
   - Pick the best active match by name similarity plus the town in the ad.
   - Store accounts type, directors and address.
   - Size band comes from accounts type: micro / small / total-exemption → small; medium; full or group → large.
   - Flag `is_group` if the company has a corporate parent or shares an address with a holding company.
   - Mark low-confidence matches as unknown rather than guessing.
   - Drop large companies from lead creation. Keep unknown.

7. **Enrich.**
   - Apify actor `compass/crawler-google-places`: batch "company name + town" queries into one run. Take the best match's phone and website, then derive the domain.
   - If `GETLEADS_API_KEY` is set, look up decision makers by domain. Prefer owner / MD / director, or the head of the department the role sits in. Store name, title, email (with status) and LinkedIn.
   - Always add the Companies House directors as contacts with source `companies_house`.
   - Never invent contact details.

8. **Create leads.**
   - One lead per job ad. Stage New.
   - `score = replace_score × (6 − build_difficulty)`, plus a bonus if size = small and a bonus if a named contact has a phone.
   - Skip jobs whose closing date has passed.
   - If the company already has other leads, link them. Add a note to each existing lead ("Also hiring: …"). Reuse the company's contacts rather than looking them up again.

9. **Finish the run.** Save the counts and a cost estimate (Claude tokens × price; Apify results × price).

---

## 5. Pages

- **Dashboard:**
  - this week's new leads
  - follow-ups due today and overdue
  - the last run's funnel (the same eight stages as a simple funnel chart)
  - leads by stage
  - a "Run hunt now" button
- **Leads table:**
  - Filters: stage, desk fit, build difficulty, size, salary range, closes within N days, has phone.
  - Default view: Strong only, sorted by build difficulty ascending, then score descending.
  - Columns: company, role(s), salary, closes, difficulty, replace/improve, best contact, phone, stage, next action.
  - Bulk stage change and CSV export.
- **Lead detail:**
  - Header: company, size, website, main phone as a `tel:` link.
  - The role(s), each with:
    - **"What they'll be doing"** first and most prominent: the responsibilities list, each duty tagged full / partial / none coverage with the `how` note
    - problem, evidence quote, AI solution, replace vs improve bar, systems, requirements, and a link to the ad
  - **"Generate build brief" button.** Claude writes a ready-to-paste Claude Code prompt to build a demo for this role, from the responsibilities, duty coverage, systems and solution. It should cover:
    - synthetic sample data matching their industry
    - a Streamlit app with a "Run demo" button
    - outputs that match the duties marked full or partial
    - a "needs human check" list
    - DEMO_SCRIPT.md, PITCH_MESSAGE.md (pitched as a service, not a job application) and NEXT_STEPS.md

    Saved to `diagnoses.build_brief`, with a copy button.
  - Contacts list with `tel:`, `mailto:` and LinkedIn links.
  - **Call panel:** opener, problem in one line, and a "Generate call script" button. Claude writes a 60-second script from the diagnosis and saves it to the lead.
  - **Log activity:** type, outcome and note, in one quick form. After a call, prompt for the next action and date.
  - Stage dropdown and an activity timeline.
  - **"Also hiring at {company}"**: the company's other leads, each with salary, difficulty, scores and stage.
- **Pipeline:** a kanban board by stage, one card per job ad, with drag-and-drop to change stage.
- **Hunts (runs):** the weekly funnel, why jobs were dropped (count per rule, with a link to every dropped job), and run history with listings / after filters / desk roles / strong / cost.
- **Builds:**
  - one card per reusable tool, with status and the clients it serves
  - a client demos table: client and role (linking to the lead), tool, status, live link, Loom, and a copy-build-brief button
  - a reserved, disabled "Generate demo" panel. In a later phase this sends a lead's build brief to Claude Code to build and deploy the demo automatically. Do not build that now.
- **Call mode (phone):** a "Today" list that steps through due calls one at a time, with:
  - company and who to ask for
  - a big call button
  - the opener
  - six outcome buttons (no answer, voicemail, gatekeeper, spoke, interested, meeting booked)
  - note and next action fields
  - "Save and next lead"
- **Settings:** edit keywords, salary range, days back and the regex lists. Show how many jobs each rule dropped last run.

### Look and feel

Match the agreed design: https://claude.ai/artifact/DPZCmK8LVm8WPgyCWA77y9 (screens: Leads, Listing view, Pipeline, Hunts, Builds, Call mode).

| Token | Value |
|---|---|
| Page background | `#F5F4F0` |
| Sidebar | `#F1EFEA` |
| Cards | white, 1px `#E4E1DA` border, 12–14px radius |
| Text | `#1B1A17` |
| Secondary text | `#5F5C55` |
| Accent | `#B4321F` (small uppercase monospace labels, due/closing-soon, the primary call-mode button) |
| Coverage: full | `#E3EFE2` / `#1F5A2E` |
| Coverage: partial | `#F6EAD3` / `#6B4100` |
| Coverage: none | `#ECEAE4` / `#3D3B36` |

- Fonts: Inter (UI, 800 for headlines) and JetBrains Mono (labels, numbers).
- Big bold page titles under a red monospace kicker, except on the Leads page.
- The Leads page is dense:
  - only the red kicker as its title
  - a compact one-line stat strip
  - rows about 60px tall: role · company · place · size on line one, the problem on line two
- Tables with monospace number columns.
- Replace / improve shown as a dark-on-grey split bar.
- Difficulty shown as "D1" plus five small dots.

Clean, fast and keyboard-friendly. Works on a phone.

---

## 6. Seed data

`/seed` contains:

- `job_problems.csv`: 257 diagnosed jobs from 5 Nov 2026. Columns: company, role, location, salary, closes, size_guess, desk_fit, build_difficulty_1to5, replace_score, improve_score, problem, evidence_from_ad, **responsibilities** (duties separated by ` | `, parsed from the ad's responsibilities section; blank where the ad had no clear section), ai_solution, ad_link, scan.
- `target_contacts.csv`: the 16 companies already pitched or queued, with contacts and phone numbers.

Write `pnpm seed`. It should:
- import the jobs (Reed id parsed from `ad_link`), the companies, the diagnoses (without call_opener) and leads for Strong rows
- import the contacts from `target_contacts.csv`
- add a `pnpm backfill` command that re-fetches each seeded ad from the Reed API, runs the responsibilities parser and Claude step 5 on every job missing responsibilities or duty coverage, and fills them in
- set those 16 leads to stage **Contacted** where my notes say I've already reached out (NFU Energy: Thomas Wilkins was messaged on LinkedIn and email), otherwise **Researched**
- seed the 6 tools and a demo row for each of the 16 targets, using the "Build status" column in `target_contacts.csv`:
  - NFU Energy: live (Loom sent 5 Nov)
  - the 5 bookkeeping clients: built
  - compliance clients: in progress
  - the rest: queued

---

## 7. Build order

Commit after each step and push.

1. Scaffold Next.js + Tailwind + shadcn, Drizzle schema and migrations, auth, the env example. Deploy an empty app to Vercel to prove the pipeline.
2. Seed script, leads table, listing view, activity logging, stages, pipeline board, builds page and call mode. (This alone makes it usable straight away.)
3. Inngest + cron wiring, then pipeline stages 1–4 (scan and filters), with a `--dry-run` that only counts.
4. Stage 5 (Claude diagnosis) with a test on 10 jobs; check the output reads well.
5. Stages 6–8 (Companies House, Apify, GetLeads, lead creation).
6. Hunts page, settings page, call-script and build-brief buttons.
7. README: setup, env vars, how to run locally, how to trigger a hunt, and costs.

Tests: unit tests for the filters, scoring, company matching and dedupe logic. Mock external APIs in tests.

Keep a `QUEUE.md` with these steps ticked off and any step in progress marked IN PROGRESS, with notes, so work can pause and resume safely.
