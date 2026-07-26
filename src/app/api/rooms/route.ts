import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { rooms, mentors, follows } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter, readLimiter, getIp } from '@/lib/ratelimit';
import { transporter } from '@/lib/mailer';
import { escapeHtml } from '@/lib/utils';

let lastCleanup = 0;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // run at most once per 5 min regardless of read volume

export async function GET(req: Request) {
  try {
    const ip = getIp(req);
    const { success } = await readLimiter.limit(ip);
    if (!success) return NextResponse.json({ error: 'Slow down a bit.' }, { status: 429 });

    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
      lastCleanup = now;
      const cutoff = new Date(now - 6 * 60 * 60 * 1000);
      await db.update(rooms).set({ status: 'ended', endedAt: new Date() }).where(and(eq(rooms.status, 'live'), lt(rooms.startedAt, cutoff)));
    }

    const result = await db
      .select({
        id: rooms.id, title: rooms.title, roomUrl: rooms.roomUrl, startedAt: rooms.startedAt,
        mentorId: mentors.id, firstName: mentors.firstName, lastName: mentors.lastName,
        role: mentors.role, company: mentors.company,
      })
      .from(rooms)
      .innerJoin(mentors, eq(rooms.mentorId, mentors.id))
      .where(eq(rooms.status, 'live'));
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'GET /api/rooms');
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

    const existing = await db.select().from(rooms).where(and(eq(rooms.mentorId, mentor.id), eq(rooms.status, 'live')));
    if (existing.length > 0) return NextResponse.json(existing[0]);

    const { title } = await req.json();
    if (title && title.length > 100) return NextResponse.json({ error: 'Title is too long' }, { status: 400 });
    const roomName = `sip-${mentor.id.slice(0, 8)}-${Date.now()}`;
    const roomUrl = `https://meet.jit.si/${roomName}`;

    const created = await db.insert(rooms).values({
      mentorId: mentor.id,
      title: title || `${mentor.firstName}'s Sip Room`,
      roomName,
      roomUrl,
    }).returning();

    (async () => {
      const followers = await db.select().from(follows).where(eq(follows.mentorId, mentor.id));
      if (followers.length === 0) return;
      const client = await clerkClient();
      for (const f of followers) {
        try {
          const followerUser = await client.users.getUser(f.seekerClerkId);
          const email = followerUser.emailAddresses[0]?.emailAddress;
          if (!email) continue;
          await transporter.sendMail({
            from: `Sip <${process.env.GMAIL_USER}>`,
            to: email,
            subject: `${mentor.firstName} is live on Sip right now`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
                <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
                <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">${escapeHtml(mentor.firstName)} ${escapeHtml(mentor.lastName)} just went live</h2>
                <p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">Jump in now before the session ends.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/rooms/${created[0].id}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Join now →</a>
              </div>
            `,
          });
        } catch (e) {
          console.error('follower notify failed:', e);
        }
      }
    })().catch(err => console.error('follower notify batch failed:', err));

    return NextResponse.json(created[0]);
  } catch (err) {
    return handleApiError(err, 'POST /api/rooms');
  }
}

export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'No mentor profile' }, { status: 403 });

    await db.update(rooms).set({ status: 'ended' }).where(and(eq(rooms.mentorId, mentor.id), eq(rooms.status, 'live')));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, 'DELETE /api/rooms');
  }
}