import { db } from '@/db';
import { requests } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { isAuthorisedCron } from '@/lib/cron-auth';
import { transporter } from '@/lib/mailer';
import { logSwallowed } from '@/lib/logger';
import {
  REMINDER_KINDS,
  REMINDER_QUERIES,
  claimReminder,
  reminderEmails,
  type ReminderKind,
  type ReminderRow,
} from '@/lib/reminders';

/**
 * Timed session reminders, driven by an EXTERNAL poller.
 *
 * NOT in vercel.json, and it must not be added there: Vercel Hobby allows two
 * cron jobs (both already spent on checkins and reminders) and caps them at once
 * per day, which cannot express T-1h or T-10m. The same constraint is documented
 * on /api/cron/go-live.
 *
 * Instead, point a free external scheduler such as cron-job.org at:
 *
 *   GET https://www.getsip.co/api/cron/session-reminders
 *   Header: Authorization: Bearer <CRON_SECRET>
 *   Schedule: every 5 minutes
 *
 * Five minutes rather than ten or fifteen because of the T-10m reminder: its
 * window is only ten minutes wide, so a poll interval above that starts dropping
 * it silently. The T-24h and T-1h windows are thirty minutes wide and survive a
 * missed run.
 *
 * Being polled from outside means no delivery guarantee and no protection from
 * overlapping runs, so nothing here relies on being called exactly once — every
 * send is claimed first, and the unique index on nudges(request_id, kind) is
 * what makes a duplicate call a no-op.
 */
export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const counts: Record<string, number> = {};

  for (const kind of REMINDER_KINDS) {
    let sent = 0;
    try {
      const due = await db.execute(REMINDER_QUERIES[kind]);

      for (const row of due.rows as unknown as ReminderRow[]) {
        // Claim before sending. The other order double-sends whenever two runs
        // overlap, which an external scheduler makes likely rather than rare.
        if (!(await claimReminder(row.id, kind))) continue;

        let enriched = row;

        if (kind === 'session_1h') {
          // Mint the confirm token now rather than at booking time, so a token
          // only exists for sips that actually reached their reminder. Written
          // before the email goes out — a token in an inbox that is not in the
          // database is a dead link.
          const token = row.confirm_token ?? crypto.randomUUID();
          if (!row.confirm_token) {
            await db.update(requests)
              .set({ confirmToken: token })
              .where(and(eq(requests.id, row.id), isNull(requests.confirmToken)));
          }
          enriched = { ...row, confirm_token: token };
        }

        for (const mail of reminderEmails(kind, enriched)) {
          try {
            await transporter.sendMail(mail);
            sent++;
          } catch (err) {
            // The claim stands. Retrying next run would be a second attempt at
            // an email the recipient may already have, which is worse than
            // skipping — the same call the daily nudge cron makes.
            logSwallowed('cron.session_reminder_failed', err, { requestId: row.id, kind, to: mail.to });
          }
        }

        if (kind === 'session_24h') {
          // The legacy daily reminder in /api/cron/reminders keys off this
          // column. Setting it here means whichever job gets there first wins
          // and the other skips, so nobody receives both.
          await db.update(requests)
            .set({ reminderSentAt: new Date() })
            .where(and(eq(requests.id, row.id), isNull(requests.reminderSentAt)));
        }
      }
    } catch (err) {
      logSwallowed('cron.session_reminder_query_failed', err, { kind });
    }
    counts[kind as ReminderKind] = sent;
  }

  return NextResponse.json({ sent: counts });
}
