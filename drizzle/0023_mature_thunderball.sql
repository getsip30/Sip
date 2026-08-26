CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resend_id" text,
	"recipient_email" text NOT NULL,
	"recipient_clerk_id" text,
	"recipient_role" text,
	"audience" text,
	"email_type" text NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text,
	"user_role" text,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mentors" ADD COLUMN "last_active_at" timestamp;--> statement-breakpoint
ALTER TABLE "seekers" ADD COLUMN "last_active_at" timestamp;--> statement-breakpoint
CREATE INDEX "email_logs_sent_at_idx" ON "email_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "events_type_created_idx" ON "events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "events_clerk_id_idx" ON "events" USING btree ("clerk_id");