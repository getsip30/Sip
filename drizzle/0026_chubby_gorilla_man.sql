ALTER TABLE "requests" ADD COLUMN "scheduled_at_timezone" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "scheduled_at_timezone" text;--> statement-breakpoint
-- Backfill: every row that already has a time gets 'UTC'.
--
-- Approved deliberately, not as a placeholder. The reminder emails
-- (src/lib/reminders.ts) have always rendered `scheduled_at` in UTC and said so
-- in the string, so UTC is the zone these rows have already been communicated
-- in. Stamping it makes the new formatters reproduce, exactly, what every
-- existing row has been telling people all along — the display changes for
-- rows booked from here on, and for nothing that came before.
--
-- Rows with a NULL `scheduled_at` are left NULL: there is no time to interpret,
-- and a zone on its own would be a claim nobody made.
UPDATE "requests" SET "scheduled_at_timezone" = 'UTC' WHERE "scheduled_at" IS NOT NULL;--> statement-breakpoint
UPDATE "rooms" SET "scheduled_at_timezone" = 'UTC' WHERE "scheduled_at" IS NOT NULL;
