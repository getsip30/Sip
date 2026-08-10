import { db } from '@/db';
import { nudges } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { escapeHtml } from '@/lib/utils';

/**
 * Timed reminders for a scheduled 1:1, at roughly T-24h, T-1h and T-10m.
 *
 * These live apart from @/lib/nudges on purpose. Nudges chase an outstanding
 * action on a daily cadence and are driven by `NUDGE_QUERIES`, which the daily
 * cron iterates wholesale — adding these kinds to that record would make the
 * once-a-day job try to send them, which is precisely the cadence they cannot
 * use. They do share the `nudges` TABLE, because the unique index on
 * (request_id, kind) is exactly the exactly-once guarantee this needs.
 */

export type ReminderKind = 'session_24h' | 'session_1h' | 'session_10m';

export const REMINDER_KINDS: ReminderKind[] = ['session_24h', 'session_1h', 'session_10m'];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://getsip.co';

export type ReminderRow = {
  id: string;
  seeker_email: string;
  seeker_name: string;
  scheduled_at: string;
  mentor_email: string;
  mentor_first_name: string;
  mentor_last_name: string;
  confirm_token: string | null;
};

/**
 * Claims the right to send one reminder.
 *
 * Mirrors claimNudge in @/lib/nudges deliberately rather than importing it:
 * that function's parameter is typed to NudgeKind, and widening it would drag
 * these kinds into `NUDGE_QUERIES`'s Record type and back into the daily cron.
 * Ten duplicated lines is the cheaper of the two couplings.
 *
 * The insert IS the lock. An external scheduler offers no delivery guarantees,
 * so overlapping or retried runs are normal, and this is what stops the same
 * person getting the same reminder twice.
 */
export async function claimReminder(requestId: string, kind: ReminderKind) {
  const claimed = await db
    .insert(nudges)
    .values({ requestId, kind })
    .onConflictDoNothing({ target: [nudges.requestId, nudges.kind] })
    .returning({ id: nudges.id });
  return claimed.length > 0;
}

/**
 * Requests due each reminder.
 *
 * Each window is bounded on BOTH sides. The upper bound is the offset itself;
 * the lower bound stops a sip booked at short notice from being told it is
 * "tomorrow" twenty minutes beforehand — if a booking is made after a window has
 * already passed, that reminder is correctly skipped rather than sent late.
 *
 * Window widths assume the poller runs at least every 5 minutes. The 24h and 1h
 * windows are 30 minutes wide and tolerate a missed run or two. The T-10m window
 * is only 10 minutes wide, because widening it would make a "starting in 10
 * minutes" email arrive twenty minutes early — so a poll interval above 10
 * minutes will silently start dropping that one. See the route for the recommended
 * schedule.
 *
 * Common conditions: accepted, still scheduled, not already started, and not
 * already resolved as cancelled or a no-show.
 */
const DUE_SELECT = sql`
  SELECT r.id, r.seeker_email, r.seeker_name, r.scheduled_at, r.confirm_token,
         m.email AS mentor_email, m.first_name AS mentor_first_name, m.last_name AS mentor_last_name
  FROM requests r JOIN mentors m ON m.id = r.mentor_id
`;

const COMMON = sql`
  r.status = 'accepted'
  AND r.scheduled_at IS NOT NULL
  AND (r.session_status IS NULL OR r.session_status = 'scheduled')
`;

export const REMINDER_QUERIES: Record<ReminderKind, ReturnType<typeof sql>> = {
  session_24h: sql`
    ${DUE_SELECT}
    WHERE ${COMMON}
      AND r.scheduled_at > now() + interval '23 hours 30 minutes'
      AND r.scheduled_at <= now() + interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM nudges n WHERE n.request_id = r.id AND n.kind = 'session_24h')
    LIMIT 200`,

  session_1h: sql`
    ${DUE_SELECT}
    WHERE ${COMMON}
      AND r.scheduled_at > now() + interval '30 minutes'
      AND r.scheduled_at <= now() + interval '1 hour'
      AND NOT EXISTS (SELECT 1 FROM nudges n WHERE n.request_id = r.id AND n.kind = 'session_1h')
    LIMIT 200`,

  session_10m: sql`
    ${DUE_SELECT}
    WHERE ${COMMON}
      AND r.scheduled_at > now()
      AND r.scheduled_at <= now() + interval '10 minutes'
      AND NOT EXISTS (SELECT 1 FROM nudges n WHERE n.request_id = r.id AND n.kind = 'session_10m')
    LIMIT 200`,
};

function shell(heading: string, body: string, cta?: { href: string; label: string }) {
  const button = cta
    ? `<a href="${cta.href}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">${cta.label}</a>`
    : '';
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
      <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
      <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">${heading}</h2>
      <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;">${body}</p>
      ${button}
    </div>
  `;
}

/** Formatted in UTC, since neither party's timezone is stored anywhere. */
function when(scheduledAt: string): string {
  return `${new Date(scheduledAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  })} UTC`;
}

export type Mail = { to: string; subject: string; html: string };

/**
 * The one or two emails a reminder sends.
 *
 * The confirm call to action goes to the seeker only. `requests.confirmed` is a
 * single boolean, so it can represent one party's answer and no more, and the
 * seeker is the side that books.
 */
export function reminderEmails(kind: ReminderKind, row: ReminderRow): Mail[] {
  const mentorName = `${escapeHtml(row.mentor_first_name)} ${escapeHtml(row.mentor_last_name)}`;
  const seekerName = escapeHtml(row.seeker_name);
  const at = when(row.scheduled_at);

  switch (kind) {
    case 'session_24h':
      return [
        {
          to: row.seeker_email,
          subject: `Your sip with ${row.mentor_first_name} is tomorrow`,
          html: shell('Sip tomorrow', `Your sip with <strong>${mentorName}</strong> is at ${at}.`),
        },
        {
          to: row.mentor_email,
          subject: `Your sip with ${row.seeker_name} is tomorrow`,
          html: shell('Sip tomorrow', `Your sip with <strong>${seekerName}</strong> is at ${at}.`),
        },
      ];

    case 'session_1h': {
      const confirmCta = row.confirm_token
        ? { href: `${APP_URL}/confirm/${row.confirm_token}`, label: "Yes, I'll be there" }
        : undefined;
      return [
        {
          to: row.seeker_email,
          subject: `Your sip with ${row.mentor_first_name} is in an hour`,
          html: shell(
            'Sip in an hour',
            `Your sip with <strong>${mentorName}</strong> starts at ${at}. Let ${escapeHtml(row.mentor_first_name)} know you are still coming.`,
            confirmCta
          ),
        },
        {
          to: row.mentor_email,
          subject: `Your sip with ${row.seeker_name} is in an hour`,
          html: shell('Sip in an hour', `Your sip with <strong>${seekerName}</strong> starts at ${at}.`),
        },
      ];
    }

    case 'session_10m':
      return [
        {
          to: row.seeker_email,
          subject: `Your sip with ${row.mentor_first_name} starts in 10 minutes`,
          html: shell('Starting in 10 minutes', `Your sip with <strong>${mentorName}</strong> starts at ${at}.`),
        },
        {
          to: row.mentor_email,
          subject: `Your sip with ${row.seeker_name} starts in 10 minutes`,
          html: shell('Starting in 10 minutes', `Your sip with <strong>${seekerName}</strong> starts at ${at}.`),
        },
      ];
  }
}
