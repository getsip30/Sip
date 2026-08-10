import { db } from '@/db';
import { sql } from 'drizzle-orm';

/**
 * Raw attendance counts for one person, across every scheduled 1:1 they were
 * part of — as the mentor or as the seeker.
 *
 * Computed on read rather than kept in counter columns on `mentors`/`seekers`.
 * There is no volume here that makes a per-user aggregate expensive, and a
 * denormalised counter is a second source of truth that drifts the first time a
 * write path is missed. If this ever shows up in a profiler, cache it — do not
 * denormalise it.
 */
export type AttendanceCounts = {
  /** Sips that had a time on the calendar. The denominator. */
  booked: number;
  completed: number;
  /** Times THIS person failed to turn up. Not times they were stood up. */
  noShows: number;
  /** completed / booked, or null when they have never booked anything. */
  rate: number | null;
};

type Row = { booked: string | number; completed: string | number; no_shows: string | number };

/**
 * Counts for a Clerk id.
 *
 * `booked` counts anything that reached a scheduled time, including sips that
 * were later cancelled. That is the honest denominator for "how often does
 * booking with this person actually result in a session".
 *
 * `completed` also accepts the legacy proof of completion — `sip_counted_at`,
 * set by the reminders cron once both sides rated the sip — so history from
 * before session_status existed is not silently counted as a failure. Without
 * that clause every established mentor would show a 0% rate on day one.
 */
export async function attendanceFor(clerkId: string): Promise<AttendanceCounts> {
  const result = await db.execute(sql`
    WITH mine AS (
      SELECT
        r.scheduled_at,
        r.session_status,
        r.sip_counted_at,
        CASE WHEN m.clerk_id = ${clerkId} THEN 'mentor' ELSE 'seeker' END AS side
      FROM requests r
      JOIN mentors m ON m.id = r.mentor_id
      WHERE m.clerk_id = ${clerkId} OR r.seeker_clerk_id = ${clerkId}
    )
    SELECT
      COUNT(*) FILTER (WHERE scheduled_at IS NOT NULL) AS booked,
      COUNT(*) FILTER (
        WHERE session_status = 'completed'
           OR (session_status IS NULL AND sip_counted_at IS NOT NULL)
      ) AS completed,
      COUNT(*) FILTER (
        WHERE (side = 'mentor' AND session_status = 'no_show_mentor')
           OR (side = 'seeker' AND session_status = 'no_show_seeker')
      ) AS no_shows
    FROM mine
  `);

  const row = (result.rows as unknown as Row[])[0];
  const booked = Number(row?.booked ?? 0);
  const completed = Number(row?.completed ?? 0);
  const noShows = Number(row?.no_shows ?? 0);

  return { booked, completed, noShows, rate: booked === 0 ? null : completed / booked };
}

/**
 * No-shows recorded against someone in the last 30 days, on a rolling window.
 *
 * Phase 4 is what acts on this. It is here now because it is one query against
 * the table Phase 1 adds, and having it available makes the Phase 4 decision a
 * matter of reading real numbers rather than guessing at them.
 */
export async function recentNoShowCount(clerkId: string, days = 30): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS n
    FROM no_show_reports
    WHERE reported_clerk_id = ${clerkId}
      AND created_at >= now() - (${days} || ' days')::interval
  `);
  return Number((result.rows as unknown as { n: string | number }[])[0]?.n ?? 0);
}
