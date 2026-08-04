CREATE TYPE "public"."badge_type" AS ENUM('founding_mentor', 'first_sip', 'five_sips', 'ten_sips', 'super_mentor');--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" uuid NOT NULL,
	"badge_type" "badge_type" NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL,
	"seen_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "mentors" ADD COLUMN "auto_accept" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "badges_mentor_id_idx" ON "badges" USING btree ("mentor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "badges_mentor_type_idx" ON "badges" USING btree ("mentor_id","badge_type");