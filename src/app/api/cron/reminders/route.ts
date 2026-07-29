import { db } from '@/db';
import { requests } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { transporter } from '@/lib/mailer';

type Row = {
  id: string; seeker_email: string; seeker_name: string; scheduled_at: string;
  mentor_first_name: string; mentor_last_name: string; mentor_email: string;
};

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;">Sip tomorrow</h2><p style="color:#C9D1D9;font-size:15px;line-height:1.7;">Your sip with ${row.mentor_first_name} ${row.mentor_last_name} is scheduled for ${when}.</p></div>`,
      });
      await transporter.sendMail({
        from: `Sip <${process.env.GMAIL_USER}>`,
        to: row.mentor_email,
        subject: `Reminder: your sip is tomorrow`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;">Sip tomorrow</h2><p style="color:#C9D1D9;font-size:15px;line-height:1.7;">Your sip with ${row.seeker_name} is scheduled for ${when}.</p></div>`,
      });
      await db.update(requests).set({ reminderSentAt: new Date() }).where(eq(requests.id, row.id));
      sent++;
    } catch (err) {
      console.error(`reminder failed for request ${row.id}:`, err);
    }
  }

  return NextResponse.json({ due: due.rows.length, sent });
}