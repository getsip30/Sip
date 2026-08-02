import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { rooms, mentors } from '@/db/schema';
import { eq, and, lt, lte } from 'drizzle-orm';
import { NextResponse, after } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter, readLimiter, getIp } from '@/lib/ratelimit';
import { notifyFollowersLive, flipToLive, notifyRoomLive } from '@/lib/rooms';
import { runOnce } from '@/lib/lock';

export async function GET(req: Request) {
  try {
    const ip = getIp(req);
    const { success } = await readLimiter.limit(ip);
    if (!success) return NextResponse.json({ error: 'Slow down a bit.' }, { status: 429 });

    // Maintenance, off the response path and behind a distributed lock. This
    // route is polled every 15s by every open tab, so without the lock every
    // instance would run these table-wide writes concurrently.
    after(() =>
      runOnce('rooms:sweep', 60, async () => {
        // 1. Sweep rooms left open for 6h+.
        const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
        await db.update(rooms).set({ status: 'ended', endedAt: new Date() })
          .where(and(eq(rooms.status, 'live'), lt(rooms.startedAt, cutoff)));

        // 2. Bring due scheduled rooms live. Backstop in place of a cron, since
        // Vercel Hobby can't run one often enough to be useful here.
        const dueRooms = await db.select({ id: rooms.id }).from(rooms)
          .where(and(eq(rooms.status, 'scheduled'), lte(rooms.scheduledAt, new Date())))
          .limit(25);
        for (const r of dueRooms) {
          const flipped = await flipToLive(r.id);
          if (flipped) await notifyRoomLive(flipped);
        }
      })
    );

    const result = await db
      .select({
        // roomUrl is deliberately absent: meet.jit.si rooms are open to anyone
        // holding the link, so it is only released to the host or a seeker whose
        // turn is active (see GET /api/rooms/[id]).
        id: rooms.id, title: rooms.title, startedAt: rooms.startedAt,
        mentorId: mentors.id, firstName: mentors.firstName, lastName: mentors.lastName,
        role: mentors.role, company: mentors.company,
        // Both are already public fields (see publicMentor), and the live-now
        // tab needs them to render a mentor the way the directory does.
        topics: mentors.topics, avatarData: mentors.avatarData,
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

    after(() => notifyFollowersLive(mentor, created[0].id));

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