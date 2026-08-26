CREATE TABLE "reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"seeker_clerk_id" text NOT NULL,
	"mentor_id" uuid NOT NULL,
	"did_differently" text,
	"counterfactual" text,
	"shareable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reflections_request_seeker_idx" ON "reflections" USING btree ("request_id","seeker_clerk_id");--> statement-breakpoint
CREATE INDEX "reflections_mentor_created_idx" ON "reflections" USING btree ("mentor_id","created_at");