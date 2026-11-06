ALTER TABLE "jobs" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "state" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "kind" text DEFAULT 'hunt' NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "phase" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "cursor" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "locked_until" timestamp with time zone;