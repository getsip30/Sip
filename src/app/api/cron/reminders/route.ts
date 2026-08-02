import { db } from '@/db';
import { isAuthorisedCron } from '@/lib/cron-auth';
import { requests, mentors } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { transporter } from '@/lib/mailer';
import { escapeHtml } from '@/lib/utils';
import { logSwallowed } from '@/lib/logger';
import { NUDGE_QUERIES, claimNudge, nudgeEmail, type NudgeKind, type NudgeRow } from '@/lib/nudges';

type Row = {
  id: string; seeker_email: string; seeker_name: string; scheduled_at: string;
  mentor_first_name: string; mentor_last_name: string; mentor_email: string;
};

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const due = await db.execute(sql`
    SELECT r.id, r.seeker_email, r.seeker_name, r.scheduled_at, m.first_name AS mentor_first_name, m.last_name AS mentor_last_name, m.email AS mentor_email
    FROM requests r
    JOIN mentors m ON m.id = r.mentor_id
    WHERE r.status = 'accepted'
      AND r.scheduled_at IS NOT NULL
      AND r.reminder_sent_at IS NULL
      AND r.scheduled_at::date = (now() + interval '1 day')::date
  `);

  let sent = 0;
  for (const row of due.rows as unknown as Row[]) {
    const when = new Date(row.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    try {
      await transporter.sendMail({
        from: `Sip <${process.env.GMAIL_USER}>`,
        to: row.seeker_email,
        subject: `Reminder: your sip is tomorrow`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;">Sip tomorrow</h2><p style="color:#C9D1D9;font-size:15px;line-height:1.7;">Your sip with ${escapeHtml(row.mentor_first_name)} ${escapeHtml(row.mentor_last_name)} is scheduled for ${when}.</p></div>`,
      });
      await transporter.sendMail({
        from: `Sip <${process.env.GMAIL_USER}>`,
        to: row.mentor_email,
        subject: `Reminder: your sip is tomorrow`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;">Sip tomorrow</h2><p style="color:#C9D1D9;font-size:15px;line-height:1.7;">Your sip with ${escapeHtml(row.seeker_name)} is scheduled for ${when}.</p></div>`,
      });
      await db.update(requests).set({ reminderSentAt: new Date() }).where(eq(requests.id, row.id));
      sent++;
    } catch (err) {
      logSwallowed('cron.reminder_failed', err, { requestId: row.id });
    }
  }

  const eligible = await db.execute(sql`
    SELECT r.id, r.mentor_id
    FROM requests r
    WHERE r.status = 'accepted'
      AND r.scheduled_at IS NOT NULL
      AND r.scheduled_at < now()
      AND r.sip_counted_at IS NULL
      AND (SELECT COUNT(*) FROM sip_feedback f where f.request_id = r.id AND f.rating >= 3) = 2
  `);

  const completedRows = eligible.rows as { id: string; mentor_id: string }[];
  const milestones: [number, string][] = [[1, 'first-sip'], [5, 'regular'], [10, 'veteran'], [25, 'legend'], [50, 'goat']];

  for (const row of completedRows) {
    const claimed = await db.update(requests)
      .set({ sipCountedAt: new Date() })
      .where(and(eq(requests.id, row.id), sql`sip_counted_at is null`))
      .returning({ id: requests.id });
    if (claimed.length === 0) continue;

    const bumped = await db.update(mentors)
      .set({ sipCount: sql`${mentors.sipCount} + 1`, xp: sql`${mentors.xp} + 25` })
      .where(eq(mentors.id, row.mentor_id))
      .returning({ sipCount: mentors.sipCount, badges: mentors.badges });

    const freshSipCount = bumped[0].sipCount;
    const existingBadges = bumped[0].badges ? bumped[0].badges.split(',').filter(Boolean) : [];
    const newBadges = [...existingBadges];
    for (const [threshold, badge] of milestones) {
      if (freshSipCount >= threshold && !newBadges.includes(badge)) newBadges.push(badge);
    }
    if (newBadges.length !== existingBadges.length) {
      await db.update(mentors).set({ badges: newBadges.join(',') }).where(eq(mentors.id, row.mentor_id));
    }
  }

  // Outstanding-action nudges. Folded into this cron rather than given their own
  // path, because the plan this runs on allows very few scheduled jobs and these
  // want the same daily cadence.
  const nudgeCounts: Record<string, number> = {};
  for (const kind of Object.keys(NUDGE_QUERIES) as NudgeKind[]) {
    let sentForKind = 0;
    try {
      const dueRows = await db.execute(NUDGE_QUERIES[kind]);
      for (const row of dueRows.rows as unknown as NudgeRow[]) {
        // Claim first. If the row is not ours another run already sent it, and
        // sending before claiming would double up whenever two runs overlap.
        if (!(await claimNudge(row.id, kind))) continue;
        const mail = nudgeEmail(kind, row);
        try {
          await transporter.sendMail({ to: mail.to, subject: mail.subject, html: mail.html });
          sentForKind++;
        } catch (err) {
          // The claim stands. A retry next run would be a second attempt at an
          // email the recipient may already have, which is worse than skipping.
          logSwallowed('cron.nudge_failed', err, { requestId: row.id, kind });
        }
      }
    } catch (err) {
      logSwallowed('cron.nudge_query_failed', err, { kind });
    }
    nudgeCounts[kind] = sentForKind;
  }

  return NextResponse.json({ due: due.rows.length, sent, sipsCompleted: completedRows.length, nudges: nudgeCounts });
}