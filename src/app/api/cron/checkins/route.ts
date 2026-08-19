import { db } from '@/db';
import { isAuthorisedCron } from '@/lib/cron-auth';
import { seekers } from '@/db/schema';
import { lte, or, isNull, and, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { transporter } from '@/lib/mailer';
import { logInfo, logSwallowed } from '@/lib/logger';

const BATCH_LIMIT = 400;
const MAIL_CONCURRENCY = 5;

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Bounded per run so the job always finishes inside the function budget;
  // whatever is left is picked up by the next night's run.
  const due = await db.select({ id: seekers.id, email: seekers.email }).from(seekers).where(
    and(
      or(isNull(seekers.lastCheckinAt), lte(seekers.lastCheckinAt, twoWeeksAgo)),
      lte(seekers.createdAt, twoWeeksAgo),
      isNull(seekers.deletedAt)
    )
  ).limit(BATCH_LIMIT);

  const html = `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
            <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
            <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Quick check-in</h2>
            <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;">
              It's been a couple of weeks since you joined Sip. What's changed since then? New goals, new questions, new direction? Might be a good time to sip with someone new.
            </p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/seekers" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">See who's open →</a>
          </div>
        `;

  const recipients = due.filter((s): s is { id: string; email: string } => !!s.email);
  const delivered: string[] = [];

  for (let i = 0; i < recipients.length; i += MAIL_CONCURRENCY) {
    const batch = recipients.slice(i, i + MAIL_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (seeker) => {
        try {
          await transporter.sendMail({
            from: `Sip <${process.env.GMAIL_USER}>`,
            to: seeker.email,
            subject: `What's changed since you started on Sip?`,
            html,
          });
          return seeker.id;
        } catch (err) {
          logSwallowed('cron.checkin_email_failed', err, { seekerId: seeker.id });
          return null;
        }
      })
    );
    delivered.push(...results.filter((r): r is string => r !== null));
  }

  // One UPDATE for the whole run instead of one per recipient.
  if (delivered.length > 0) {
    await db.update(seekers).set({ lastCheckinAt: new Date() }).where(inArray(seekers.id, delivered));
  }

  logInfo('cron.checkins_complete', { due: due.length, sent: delivered.length });
  return NextResponse.json({ checked: due.length, sent: delivered.length });
}