-- Only session_notes is new.
--
-- drizzle-kit generate also emitted site_feedback, requests.mentor_note,
-- requests.sip_counted_at and rooms.scheduled_at, because the snapshot in
-- drizzle/meta had fallen behind a database that has been managed with
-- `drizzle-kit push`. All four were verified present in the live database and
-- have been removed from this file; replaying them would abort on "already
-- exists". The 0012 snapshot does record them, so future diffs start clean.
--
-- Guarded so it is safe to run more than once.

CREATE TABLE IF NOT EXISTS "session_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" uuid NOT NULL,
	"session_id" uuid,
	"seeker_clerk_id" text NOT NULL,
	"seeker_name" text NOT NULL,
	"session_date" timestamp DEFAULT now() NOT NULL,
	"note_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_session_id_rooms_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_notes_mentor_id_idx" ON "session_notes" USING btree ("mentor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_notes_mentor_date_idx" ON "session_notes" USING btree ("mentor_id","session_date");
