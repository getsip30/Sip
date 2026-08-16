CREATE TABLE "takeaways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"room_id" uuid,
	"author_clerk_id" text NOT NULL,
	"author_role" text NOT NULL,
	"subject_seeker_clerk_id" text,
	"subject_name" text,
	"bullets" text NOT NULL,
	"session_label" text NOT NULL,
	"session_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "takeaways_one_parent" CHECK (num_nonnulls("takeaways"."request_id", "takeaways"."room_id") <= 1)
);
--> statement-breakpoint
ALTER TABLE "takeaways" ADD CONSTRAINT "takeaways_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeaways" ADD CONSTRAINT "takeaways_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "takeaways_author_idx" ON "takeaways" USING btree ("author_clerk_id","session_date");--> statement-breakpoint
CREATE INDEX "takeaways_room_idx" ON "takeaways" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "takeaways_author_request_idx" ON "takeaways" USING btree ("author_clerk_id","request_id") WHERE request_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "takeaways_author_room_group_idx" ON "takeaways" USING btree ("author_clerk_id","room_id") WHERE room_id is not null and subject_seeker_clerk_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "takeaways_author_room_subject_idx" ON "takeaways" USING btree ("author_clerk_id","room_id","subject_seeker_clerk_id") WHERE room_id is not null and subject_seeker_clerk_id is not null;