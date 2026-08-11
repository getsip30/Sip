ALTER TABLE "no_show_reports" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "no_show_reports" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
CREATE INDEX "no_show_reports_status_idx" ON "no_show_reports" USING btree ("status");