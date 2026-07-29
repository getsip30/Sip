CREATE TABLE "sip_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"role" text NOT NULL,
	"rater_clerk_id" text,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "sip_feedback" ADD CONSTRAINT "sip_feedback_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sip_feedback" ADD CONSTRAINT "sip_feedback_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sip_feedback_request_id_idx" ON "sip_feedback" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "sip_feedback_mentor_id_idx" ON "sip_feedback" USING btree ("mentor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sip_feedback_unique_idx" ON "sip_feedback" USING btree ("request_id","role");