import { db } from '@/db';
import { nudges } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { escapeHtml } from '@/lib/utils';

export type NudgeKind =
  | 'seeker_book_48h'
  | 'seeker_book_5d'
  | 'mentor_respond_48h'
  | 'mentor_connect_24h';

export type NudgeRow = {
  id: string;
  seeker_email: string;
  seeker_name: string;
  mentor_email: string;
  mentor_first_name: string;
  mentor_last_name: string;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://getsip.co';

/**
 * Claims the right to send one nudge.
 *
 * The insert is the lock. Two overlapping cron runs both reach this, and the
 * unique index means exactly one of them gets a row back, so the loser sends
 * nothing rather than the seeker getting the same reminder twice. Doing the
 * check as a separate SELECT would leave that race open.
 */
export async function claimNudge(requestId: string, kind: NudgeKind) {
  const claimed = await db
    .insert(nudges)
    .values({ requestId, kind })
    .onConflictDoNothing({ target: [nudges.requestId, nudges.kind] })
    .returning({ id: nudges.id });
  return claimed.length > 0;
}

function shell(heading: string, body: string, cta: { href: string; label: string }) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
      <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
      <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">${heading}</h2>
      <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;">${body}</p>
      <a href="${cta.href}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">${cta.label}</a>
    </div>
  `;
}

/**
 * Subject and body per kind. Each one names what is waiting and who it is
 * waiting on, since a reminder that does not say what to do is just noise.
 */
export function nudgeEmail(kind: NudgeKind, row: NudgeRow): { to: string; subject: string; html: string } {
  const mentorName = `${escapeHtml(row.mentor_first_name)} ${escapeHtml(row.mentor_last_name)}`;
  const seekerName = escapeHtml(row.seeker_name);

  switch (kind) {
    case 'seeker_book_48h':
      return {
        to: row.seeker_email,
        subject: `You still need to book with ${row.mentor_first_name}`,
        html: shell(
          'Your sip is waiting on a time',
          `<strong>${mentorName}</strong> said yes two days ago, but nothing is on the calendar yet. Pick a time that suits you and it is done.`,
          { href: `${APP_URL}/seekers`, label: 'Book your sip' }
        ),
      };

    case 'seeker_book_5d':
      return {
        to: row.seeker_email,
        subject: `Last nudge about your sip with ${row.mentor_first_name}`,
        html: shell(
          'Still holding a spot for you',
          `<strong>${mentorName}</strong> accepted your request five days ago. This is the last reminder, so book a time if you still want it.`,
          { href: `${APP_URL}/seekers`, label: 'Book your sip' }
        ),
      };

    case 'mentor_respond_48h':
      return {
        to: row.mentor_email,
        subject: `${row.seeker_name} is still waiting on you`,
        html: shell(
          'A request has been sitting for two days',
          `<strong>${seekerName}</strong> asked for a sip and has not heard back. Accepting or declining both take one click, and either is better than silence.`,
          { href: `${APP_URL}/dashboard`, label: 'Open your dashboard' }
        ),
      };

    case 'mentor_connect_24h':
      return {
        to: row.mentor_email,
        subject: `Finish the 1:1 you started with ${row.seeker_name}`,
        html: shell(
          'You asked for a 1:1 but did not send anything',
          `You started a 1:1 with <strong>${seekerName}</strong> and chose to review it yourself, so they are still waiting on your booking link.`,
          { href: `${APP_URL}/dashboard`, label: 'Send your link' }
        ),
      };
  }
}

/**
 * Requests due each kind of nudge.
 *
 * Every query excludes anything already recorded in nudges, so re-running the
 * cron on the same day is a no-op rather than a second send.
 *
 * Each also has a floor of 30 days. Without it the first run after deploy would
 * chase every unbooked request ever made, because none of them have a nudge row
 * yet. Anything older than that is not worth an email.
 */
export const NUDGE_QUERIES: Record<NudgeKind, ReturnType<typeof sql>> = {
  // Accepted, no time on the calendar, answered at least 48h ago.
  seeker_book_48h: sql`
    SELECT r.id, r.seeker_email, r.seeker_name, m.email AS mentor_email,
           m.first_name AS mentor_first_name, m.last_name AS mentor_last_name
    FROM requests r JOIN mentors m ON m.id = r.mentor_id
    WHERE r.status = 'accepted' AND r.scheduled_at IS NULL
      AND r.responded_at IS NOT NULL AND r.responded_at <= now() - interval '48 hours'
      AND r.responded_at >= now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM nudges n WHERE n.request_id = r.id AND n.kind = 'seeker_book_48h')
    LIMIT 200`,

  seeker_book_5d: sql`
    SELECT r.id, r.seeker_email, r.seeker_name, m.email AS mentor_email,
           m.first_name AS mentor_first_name, m.last_name AS mentor_last_name
    FROM requests r JOIN mentors m ON m.id = r.mentor_id
    WHERE r.status = 'accepted' AND r.scheduled_at IS NULL
      AND r.responded_at IS NOT NULL AND r.responded_at <= now() - interval '5 days'
      AND r.responded_at >= now() - interval '30 days'
      -- The final nudge only follows the first one. Without this a request that
      -- is already older than five days matches both queries and the seeker
      -- gets two emails in the same run.
      AND EXISTS (SELECT 1 FROM nudges n WHERE n.request_id = r.id AND n.kind = 'seeker_book_48h')
      AND NOT EXISTS (SELECT 1 FROM nudges n WHERE n.request_id = r.id AND n.kind = 'seeker_book_5d')
    LIMIT 200`,

  // Seeker-initiated (no origin room) and still unanswered after 48h.
  mentor_respond_48h: sql`
    SELECT r.id, r.seeker_email, r.seeker_name, m.email AS mentor_email,
           m.first_name AS mentor_first_name, m.last_name AS mentor_last_name
    FROM requests r JOIN mentors m ON m.id = r.mentor_id
    WHERE r.status = 'pending' AND r.origin_room_id IS NULL
      AND r.created_at <= now() - interval '48 hours'
      AND r.created_at >= now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM nudges n WHERE n.request_id = r.id AND n.kind = 'mentor_respond_48h')
    LIMIT 200`,

  // The mentor's own 1:1 where they chose to review rather than send a link,
  // and then never did. link_sent_at excludes the send-now path outright.
  mentor_connect_24h: sql`
    SELECT r.id, r.seeker_email, r.seeker_name, m.email AS mentor_email,
           m.first_name AS mentor_first_name, m.last_name AS mentor_last_name
    FROM requests r JOIN mentors m ON m.id = r.mentor_id
    WHERE r.status = 'pending' AND r.origin_room_id IS NOT NULL AND r.link_sent_at IS NULL
      AND r.created_at <= now() - interval '24 hours'
      AND r.created_at >= now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM nudges n WHERE n.request_id = r.id AND n.kind = 'mentor_connect_24h')
    LIMIT 200`,
};
