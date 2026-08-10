CREATE TABLE "no_show_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"reported_by_clerk_id" text NOT NULL,
	"reported_clerk_id" text,
	"reported_role" text NOT NULL,
	"evidence_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "session_status" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "confirm_token" text;--> statement-breakpoint
ALTER TABLE "no_show_reports" ADD CONSTRAINT "no_show_reports_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "no_show_reports_request_id_idx" ON "no_show_reports" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "no_show_reports_reported_created_idx" ON "no_show_reports" USING btree ("reported_clerk_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "no_show_reports_request_reporter_idx" ON "no_show_reports" USING btree ("request_id","reported_by_clerk_id");--> statement-breakpoint
CREATE INDEX "requests_session_status_idx" ON "requests" USING btree ("session_status");--> statement-breakpoint
CREATE UNIQUE INDEX "requests_confirm_token_idx" ON "requests" USING btree ("confirm_token");