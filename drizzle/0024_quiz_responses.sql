CREATE TABLE "quiz_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"interest" text NOT NULL,
	"mentor_id" uuid,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_responses_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_responses_session_id_idx" ON "quiz_responses" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "quiz_responses_created_at_idx" ON "quiz_responses" USING btree ("created_at");