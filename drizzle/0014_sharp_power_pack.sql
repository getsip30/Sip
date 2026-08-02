CREATE TABLE "session_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"seeker_clerk_id" text NOT NULL,
	"role" text NOT NULL,
	"rater_clerk_id" text NOT NULL,
	"rating" integer NOT NULL,
	"would_sip_again" boolean,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sip_notes" ADD COLUMN "featured" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_feedback_room_id_idx" ON "session_feedback" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "session_feedback_mentor_id_idx" ON "session_feedback" USING btree ("mentor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_feedback_unique_idx" ON "session_feedback" USING btree ("room_id","seeker_clerk_id","role");