import { pgTable, serial, text, integer, timestamp, boolean, jsonb, date, uniqueIndex, index } from "drizzle-orm/pg-core";

export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  trigger: text("trigger").notNull(), // cron | manual | seed
  label: text("label"),
  status: text("status").notNull().default("done"),
  counts: jsonb("counts").$type<Record<string, number>>(),
  costEstimateGbp: text("cost_estimate_gbp"),
  error: text("error"),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  normalisedName: text("normalised_name").notNull(),
  chNumber: text("ch_number"),
  chStatus: text("ch_status"),
  accountsType: text("accounts_type"),
  sizeBand: text("size_band").notNull().default("unknown"), // SMB | Mid-size | Charity/housing | Large/group | Agency/RPO | unknown
  directors: jsonb("directors").$type<string[]>(),
  registeredAddress: text("registered_address"),
  website: text("website"),
  domain: text("domain"),
  mainPhone: text("main_phone"),
  isGroup: boolean("is_group").default(false).notNull(),
  notes: text("notes"),
}, (t) => [uniqueIndex("companies_norm_idx").on(t.normalisedName)]);

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().default("reed"),
  sourceJobId: text("source_job_id").notNull(),
  companyId: integer("company_id").references(() => companies.id),
  title: text("title").notNull(),
  location: text("location"),
  salaryText: text("salary_text"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  postedAt: date("posted_at"),
  closesAt: date("closes_at"),
  url: text("url").notNull(),
  descriptionHtml: text("description_html"),
  description: text("description"),
  responsibilities: jsonb("responsibilities").$type<string[]>(),
  responsibilitiesSource: text("responsibilities_source"), // section | claude
  requirements: jsonb("requirements").$type<string[]>(),
  runId: integer("run_id").references(() => runs.id),
  filterStatus: text("filter_status").notNull().default("kept"),
  dropReason: text("drop_reason"),
  scan: text("scan"),
}, (t) => [uniqueIndex("jobs_source_idx").on(t.source, t.sourceJobId)]);

export type DutyCoverage = { duty: string; coverage: "full" | "partial" | "none"; how: string };

export const diagnoses = pgTable("diagnoses", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  deskFit: text("desk_fit").notNull(), // strong | partial | poor
  easeOfBuild: integer("ease_of_build").notNull(), // 1-5, 5 = easiest
  replaceScore: integer("replace_score").notNull(),
  improveScore: integer("improve_score").notNull(),
  problem: text("problem"),
  evidence: text("evidence"),
  solution: text("solution"),
  dutyCoverage: jsonb("duty_coverage").$type<DutyCoverage[]>(),
  systems: jsonb("systems").$type<string[]>(),
  callOpener: text("call_opener"),
  callScript: text("call_script"),
  buildBrief: text("build_brief"),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("diagnoses_job_idx").on(t.jobId)]);

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  emailStatus: text("email_status").default("unknown"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  source: text("source").default("manual"),
  notes: text("notes"),
});

export const STAGES = ["New", "Researched", "Contacted", "Conversation", "Demo sent", "Proposal", "Won", "Lost", "Not now"] as const;
export type Stage = (typeof STAGES)[number];

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  stage: text("stage").$type<Stage>().notNull().default("New"),
  stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).defaultNow().notNull(),
  nextAction: text("next_action"),
  nextActionAt: date("next_action_at"),
  estValueGbpMonth: integer("est_value_gbp_month"),
  score: integer("score").notNull().default(0),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("leads_job_idx").on(t.jobId), index("leads_company_idx").on(t.companyId)]);

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  contactId: integer("contact_id").references(() => contacts.id),
  type: text("type").notNull(), // call | email | linkedin | note | demo | proposal | system
  outcome: text("outcome"),
  body: text("body"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("queued"), // queued | in_progress | built | live
  description: text("description"),
  repoPath: text("repo_path"),
}, (t) => [uniqueIndex("tools_name_idx").on(t.name)]);

export const demos = pgTable("demos", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  toolId: integer("tool_id").references(() => tools.id),
  status: text("status").notNull().default("queued"),
  liveUrl: text("live_url"),
  loomUrl: text("loom_url"),
  loomNote: text("loom_note"),
  buildBrief: text("build_brief"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
});
