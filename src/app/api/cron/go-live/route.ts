import { db } from '@/db';
import { rooms, mentors, follows } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { transporter } from '@/lib/mailer';
import { escapeHtml } from '@/lib/utils';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const due = await db.select().from(rooms).where(and(eq(rooms.status, 'scheduled'), lte(rooms.scheduledAt, new Date())));

  let wentLive = 0;
  for (const room of due) {
    const flipped = await db.update(rooms)
      .set({ status: 'live', startedAt: new Date() })
      .where(and(eq(rooms.id, room.id), eq(rooms.status, 'scheduled')))
      .returning();
    if (flipped.length === 0) continue;
    wentLive++;

    const mentorRows = await db.select().from(mentors).where(eq(mentors.id, room.mentorId));
    const mentor = mentorRows[0];
    if (!mentor) continue;

    const roomLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/rooms/${room.id}`;

    try {
      await transporter.sendMail({
        to: mentor.email,
        subject: `You're live on Sip`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;">Your scheduled sip just started</h2><p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">Seekers can now line up. Jump into your room:</p><a href="${roomLink}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Go to your room →</a></div>`,
      });
    } catch (e) {
      console.error(`go-live mentor notify failed for room ${room.id}:`, e);
    }

    try {
      const followers = await db.select().from(follows).where(eq(follows.mentorId, mentor.id));
      if (followers.length > 0) {
        const client = await clerkClient();
        for (const f of followers) {
          try {
            const followerUser = await client.users.getUser(f.seekerClerkId);
            const email = followerUser.emailAddresses[0]?.emailAddress;
            if (!email) continue;
            await transporter.sendMail({
              to: email,
              subject: `${mentor.firstName} is live on Sip right now`,
              html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">${escapeHtml(mentor.firstName)} ${escapeHtml(mentor.lastName)} just went live</h2><p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">Jump in now before the session ends.</p><a href="${roomLink}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Join now →</a></div>`,
            });
          } catch (e) {
            console.error('go-live follower notify failed:', e);
          }
        }
      }
    } catch (e) {
      console.error(`go-live followers lookup failed for mentor ${mentor.id}:`, e);
    }
  }

  return NextResponse.json({ due: due.length, wentLive });
}