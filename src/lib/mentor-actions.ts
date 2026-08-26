import { db } from '@/db';
import { nudges } from '@/db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';
import { escapeHtml } from '@/lib/utils';

/**
 * The two things a mentor can do about a sip they accepted that never got a
 * time: nudge the seeker, or hand it to us to look at.
 *
 * Kept out of @/lib/nudges for the same reason @/lib/reminders is: NUDGE_QUERIES
 * is a `Record<NudgeKind, ...>` that the daily cron iterates wholesale, so any
 * kind added to that union has to have a query and will be sent automatically.
 * These two are pressed by a person, not scheduled, and must never be picked up
 * by a cron run. They do share the `nudges` TABLE, whose unique index on
 * (request_id, kind) is the throttle.
 */

export type MentorActionKind = 'mentor_nudge_seeker';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://getsip.co';

/**
 * How long a mentor must wait before nudging the same seeker again.
 *
 * A once-ever guard would be simpler, but wrong: a fortnight later the mentor
 * may reasonably want to ask again, and having the button silently do nothing
 * is worse than not offering it. A day is long enough that this cannot become
 * a way to pester someone.
 */
export const NUDGE_COOLDOWN = sql`interval '24 hours'`;

/**
 * Claims the right to send one manual nudge, or reports that it is too soon.
 *
 * One statement, so two clicks racing each other cannot both win. The insert is
 * the lock on the first send; on a repeat, the update only fires when the last
 * one is a day old, and an update that does not fire returns no row — which is
 * exactly the "too soon" answer the route needs.
 */
export async function claimMentorNudge(requestId: string): Promise<boolean> {
  const kind: MentorActionKind = 'mentor_nudge_seeker';
  const claimed = await db
    .insert(nudges)
    .values({ requestId, kind })
    .onConflictDoUpdate({
      target: [nudges.requestId, nudges.kind],
      set: { sentAt: new Date() },
      setWhere: and(
        eq(nudges.requestId, requestId),
        eq(nudges.kind, kind),
        lt(nudges.sentAt, sql`now() - ${NUDGE_COOLDOWN}`),
      ),
    })
    .returning({ id: nudges.id });
  return claimed.length > 0;
}

/**
 * The nudge itself, from the mentor to the seeker.
 *
 * Written as the mentor wondering where they got to, not as a final notice.
 * The mentor pressed a button labelled "nudge them"; they did not ask us to
 * threaten anyone on their behalf.
 */
export function seekerNudgeEmail({
  seekerEmail,
  seekerName,
  mentorFirstName,
}: {
  seekerEmail: string;
  seekerName: string;
  mentorFirstName: string;
}) {
  const mentor = escapeHtml(mentorFirstName);
  return {
    to: seekerEmail,
    subject: `${mentorFirstName} is still holding a spot for you`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
        <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
        <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Still up for it?</h2>
        <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;">
          Hi ${escapeHtml(seekerName)} — ${mentor} noticed you haven't picked a date for your sip yet.
          Whenever you're ready, pick a time that works and log it on Sip so ${mentor} knows when to expect you.
        </p>
        <a href="${APP_URL}/seekers" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Pick a time</a>
      </div>
    `,
  };
}
