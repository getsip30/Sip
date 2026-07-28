import { db } from '@/db';
import { seekers } from '@/db/schema';
import { lte, or, isNull, and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { transporter } from '@/lib/mailer';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const due = await db.select().from(seekers).where(
    and(
      or(isNull(seekers.lastCheckinAt), lte(seekers.lastCheckinAt, twoWeeksAgo)),
      lte(seekers.createdAt, twoWeeksAgo)
    )
  );

  let sent = 0;
  for (const seeker of due) {
    if (!seeker.email) continue;
    try {
      await transporter.sendMail({
        from: `Sip <${process.env.GMAIL_USER}>`,
        to: seeker.email,
        subject: `What's changed since you started on Sip?`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
            <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
            <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Quick check-in</h2>
            <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;">
              It's been a month since you joined Sip. What's changed since then? New goals, new questions, new direction? Might be a good time to sip with someone new.
            </p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/seekers" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">See who's open →</a>
          </div>
        `,
      });
      await db.update(seekers).set({ lastCheckinAt: new Date() }).where(eq(seekers.id, seeker.id));
      sent++;
    } catch (err) {
      console.error(`Failed to email seeker ${seeker.id}:`, err);
    }
  }

  return NextResponse.json({ checked: due.length, sent });
}