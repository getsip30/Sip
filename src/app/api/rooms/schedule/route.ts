import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { rooms, mentors, follows } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse, after } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { transporter } from '@/lib/mailer';
import { escapeHtml } from '@/lib/utils';

const MIN_LEAD_MS = 10 * 60 * 1000;
const MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'No mentor profile' }, { status: 403 });

    const scheduled = await db.select().from(rooms).where(and(eq(rooms.mentorId, mentor.id), eq(rooms.status, 'scheduled')));
    return NextResponse.json(scheduled[0] || null);
  } catch (err) {
    return handleApiError(err, 'GET /api/rooms/schedule');
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'No mentor profile' }, { status: 403 });
    if (mentor.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    const existingLive = await db.select().from(rooms).where(and(eq(rooms.mentorId, mentor.id), eq(rooms.status, 'live')));
    if (existingLive.length > 0) return NextResponse.json({ error: "You're already live. End your current sip first." }, { status: 400 });

    const existingScheduled = await db.select().from(rooms).where(and(eq(rooms.mentorId, mentor.id), eq(rooms.status, 'scheduled')));
    if (existingScheduled.length > 0) return NextResponse.json(existingScheduled[0]);

    const { scheduledAt, title } = await req.json();
    const when = new Date(scheduledAt);
    if (isNaN(when.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    const leadMs = when.getTime() - Date.now();
    if (leadMs < MIN_LEAD_MS) return NextResponse.json({ error: 'Pick a time at least 10 minutes from now.' }, { status: 400 });
    if (leadMs > MAX_LEAD_MS) return NextResponse.json({ error: 'Pick a time within the next 30 days.' }, { status: 400 });
    if (title && title.length > 100) return NextResponse.json({ error: 'Title is too long' }, { status: 400 });

    const roomName = `sip-${mentor.id.slice(0, 8)}-${Date.now()}`;
    const roomUrl = `https://meet.jit.si/${roomName}`;

    const created = await db.insert(rooms).values({
      mentorId: mentor.id,
      title: title || `${mentor.firstName}'s Sip Room`,
      roomName,
      roomUrl,
      status: 'scheduled',
      scheduledAt: when,
    }).returning();

    const whenStr = when.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    // `after()` rather than a floating promise — on serverless the latter can be
    // killed the moment the response is returned.
    after(async () => {
      const followers = await db.select().from(follows).where(eq(follows.mentorId, mentor.id));
      if (followers.length === 0) return;
      const client = await clerkClient();
      for (const f of followers) {
        try {
          const followerUser = await client.users.getUser(f.seekerClerkId);
          const email = followerUser.emailAddresses[0]?.emailAddress;
          if (!email) continue;
          await transporter.sendMail({
            to: email,
            subject: `${mentor.firstName} scheduled a sip for ${whenStr}`,
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">${escapeHtml(mentor.firstName)} ${escapeHtml(mentor.lastName)} is going live ${whenStr}</h2><p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">Line up in the queue right when it starts.</p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/rooms/${created[0].id}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">View session →</a></div>`,
          });
        } catch (e) {
          console.error('scheduled-session follower notify failed:', e);
        }
      }
    });

    return NextResponse.json(created[0]);
  } catch (err) {
    return handleApiError(err, 'POST /api/rooms/schedule');
  }
}

export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'No mentor profile' }, { status: 403 });

    await db.update(rooms).set({ status: 'ended', endedAt: new Date() }).where(and(eq(rooms.mentorId, mentor.id), eq(rooms.status, 'scheduled')));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, 'DELETE /api/rooms/schedule');
  }
}