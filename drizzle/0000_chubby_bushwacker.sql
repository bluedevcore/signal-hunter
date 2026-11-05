CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"contact_id" integer,
	"type" text NOT NULL,
	"outcome" text,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"normalised_name" text NOT NULL,
	"ch_number" text,
	"ch_status" text,
	"accounts_type" text,
	"size_band" text DEFAULT 'unknown' NOT NULL,
	"directors" jsonb,
	"registered_address" text,
	"website" text,
	"domain" text,
	"main_phone" text,
	"is_group" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"email_status" text DEFAULT 'unknown',
	"phone" text,
	"linkedin" text,
	"source" text DEFAULT 'manual',
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "demos" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"tool_id" integer,
	"status" text DEFAULT 'queued' NOT NULL,
	"live_url" text,
	"loom_url" text,
	"loom_note" text,
	"build_brief" text,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnoses" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"desk_fit" text NOT NULL,
	"ease_of_build" integer NOT NULL,
	"replace_score" integer NOT NULL,
	"improve_score" integer NOT NULL,
	"problem" text,
	"evidence" text,
	"solution" text,
	"duty_coverage" jsonb,
	"systems" jsonb,
	"call_opener" text,
	"call_script" text,
	"build_brief" text,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'reed' NOT NULL,
	"source_job_id" text NOT NULL,
	"company_id" integer,
	"title" text NOT NULL,
	"location" text,
	"salary_text" text,
	"salary_min" integer,
	"salary_max" integer,
	"posted_at" date,
	"closes_at" date,
	"url" text NOT NULL,
	"description_html" text,
	"description" text,
	"responsibilities" jsonb,
	"responsibilities_source" text,
	"requirements" jsonb,
	"run_id" integer,
	"filter_status" text DEFAULT 'kept' NOT NULL,
	"drop_reason" text,
	"scan" text
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"stage" text DEFAULT 'New' NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_action" text,
	"next_action_at" date,
	"est_value_gbp_month" integer,
	"score" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"trigger" text NOT NULL,
	"label" text,
	"status" text DEFAULT 'done' NOT NULL,
	"counts" jsonb,
	"cost_estimate_gbp" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"description" text,
	"repo_path" text
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demos" ADD CONSTRAINT "demos_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demos" ADD CONSTRAINT "demos_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_norm_idx" ON "companies" USING btree ("normalised_name");--> statement-breakpoint
CREATE UNIQUE INDEX "diagnoses_job_idx" ON "diagnoses" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_idx" ON "jobs" USING btree ("source","source_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_job_idx" ON "leads" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "leads_company_idx" ON "leads" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tools_name_idx" ON "tools" USING btree ("name");