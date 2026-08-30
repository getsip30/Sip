CREATE TABLE "mentor_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" uuid NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mentors" ADD COLUMN "tags" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "mentor_experiences" ADD CONSTRAINT "mentor_experiences_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mentor_experiences_mentor_idx" ON "mentor_experiences" USING btree ("mentor_id","sort_order");