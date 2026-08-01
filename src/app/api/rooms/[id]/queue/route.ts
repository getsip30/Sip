import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { queueEntries, rooms, seekers, flags, mentors } from '@/db/schema';
import { eq, and, sql, inArray, ne, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter, readLimiter, getIp } from '@/lib/ratelimit';
import { isUuid, cleanText } from '@/lib/validate';

const STALE_WAITING_MS = 30 * 60 * 1000;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getIp(req);
    const { success } = await readLimiter.limit(ip);
    if (!success) return NextResponse.json({ error: 'Slow down a bit.' }, { status: 429 });

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ waiting: [], active: [], done: [] });

    const { userId: viewerId } = await auth();
    const staleCutoff = new Date(Date.now() - STALE_WAITING_MS);
    await db.update(queueEntries).set({ status: 'left' })
      .where(and(eq(queueEntries.roomId, id), eq(queueEntries.status, 'waiting'), lt(queueEntries.joinedAt, staleCutoff)));

    const result = await db.select().from(queueEntries)
      .where(and(eq(queueEntries.roomId, id), eq(queueEntries.status, 'waiting')))
      .orderBy(queueEntries.joinedAt);
    const active = await db.select().from(queueEntries)
      .where(and(eq(queueEntries.roomId, id), eq(queueEntries.status, 'active')));
    const done = await db.select().from(queueEntries)
      .where(and(eq(queueEntries.roomId, id), eq(queueEntries.status, 'done')))
      .orderBy(sql`${queueEntries.doneAt} desc`)
      .limit(50);

    const allEntries = [...result, ...active, ...done];
    const clerkIds = [...new Set(allEntries.map(e => e.seekerClerkId).filter(Boolean))] as string[];

    let visitCounts: Record<string, number> = {};
    let flagCounts: Record<string, number> = {};

    if (clerkIds.length > 0) {
      const room = await db.select().from(rooms).where(eq(rooms.id, id));
      const mentorId = room[0]?.mentorId;

      if (mentorId) {
        const mentorRooms = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.mentorId, mentorId));
        const roomIds = mentorRooms.map(r => r.id);
        const visits = await db.select({ seekerClerkId: queueEntries.seekerClerkId, count: sql<number>`count(*)::int` })
          .from(queueEntries)
          .where(and(inArray(queueEntries.roomId, roomIds), inArray(queueEntries.seekerClerkId, clerkIds)))
          .groupBy(queueEntries.seekerClerkId);
        visitCounts = Object.fromEntries(visits.map(v => [v.seekerClerkId as string, v.count]));
      }

      const flagRows = await db.select({ reportedClerkId: flags.reportedClerkId, count: sql<number>`count(*)::int` })
        .from(flags)
        .where(and(inArray(flags.reportedClerkId, clerkIds), ne(flags.status, 'dismissed')))
        .groupBy(flags.reportedClerkId);
      flagCounts = Object.fromEntries(flagRows.map(f => [f.reportedClerkId as string, f.count]));
    }

    let viewerIsMentor = false;
    if (viewerId) {
      const room = await db.select().from(rooms).where(eq(rooms.id, id));
      const mentorRow = room[0] ? await db.select().from(mentors).where(eq(mentors.id, room[0].mentorId)) : [];
      viewerIsMentor = mentorRow[0]?.clerkId === viewerId;
    }

    const attach = (e: typeof allEntries[number]) => {
      // `isMine` lets a seeker find their own entry without exposing anyone
      // else's clerkId. Without it non-mentors had no way to identify themselves,
      // so their queue position reset to null on every poll.
      const base = {
        id: e.id, roomId: e.roomId, seekerName: e.seekerName, topic: e.topic, status: e.status,
        joinedAt: e.joinedAt, calledAt: e.calledAt, doneAt: e.doneAt,
        isMine: !!viewerId && e.seekerClerkId === viewerId,
      };
      if (!viewerIsMentor) return base;
      return {
        ...base,
        seekerClerkId: e.seekerClerkId,
        visitCount: e.seekerClerkId ? (visitCounts[e.seekerClerkId] || 0) : 0,
        flagCount: e.seekerClerkId ? (flagCounts[e.seekerClerkId] || 0) : 0,
      };
    };

    return NextResponse.json({
      waiting: result.map(attach),
      active: active.map(attach),
      done: done.map(attach),
    });
  } catch (err) {
    return handleApiError(err, 'GET /api/rooms/[id]/queue');
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Room not found or ended' }, { status: 404 });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const room = await db.select().from(rooms).where(and(eq(rooms.id, id), eq(rooms.status, 'live')));
    if (!room[0]) return NextResponse.json({ error: 'Room not found or ended' }, { status: 404 });

    const roomMentor = await db.select().from(mentors).where(eq(mentors.id, room[0].mentorId));
    if (roomMentor[0]?.clerkId === userId) {
      return NextResponse.json({ error: "You can't join your own room's queue." }, { status: 403 });
    }

    const seekerCheck = await db.select().from(seekers).where(eq(seekers.clerkId, userId));
    if (seekerCheck[0]?.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    const existing = await db.select().from(queueEntries).where(and(
      eq(queueEntries.roomId, id),
      eq(queueEntries.seekerClerkId, userId),
    ));
    const alreadyIn = existing.find(e => e.status === 'waiting' || e.status === 'active');
    if (alreadyIn) return NextResponse.json(alreadyIn);

    const { seekerName, topic } = await req.json();
    const cleanName = cleanText(seekerName, 100);
    if (!cleanName) return NextResponse.json({ error: 'Name is required and must be under 100 characters' }, { status: 400 });
    if (topic !== undefined && topic !== null && topic !== '' && !cleanText(topic, 140)) {
      return NextResponse.json({ error: 'Topic is too long' }, { status: 400 });
    }

    try {
      const created = await db.insert(queueEntries).values({
        roomId: id, seekerClerkId: userId, seekerName: cleanName, topic: cleanText(topic, 140), status: 'waiting',
      }).returning();
      return NextResponse.json(created[0]);
    } catch (insertErr: any) {
      if (insertErr?.code === '23505') {
        const race = await db.select().from(queueEntries).where(and(
          eq(queueEntries.roomId, id), eq(queueEntries.seekerClerkId, userId),
        ));
        const stillIn = race.find(e => e.status === 'waiting' || e.status === 'active');
        if (stillIn) return NextResponse.json(stillIn);
      }
      throw insertErr;
    }
  } catch (err) {
    return handleApiError(err, 'POST /api/rooms/[id]/queue');
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ ok: true });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await db.update(queueEntries)
      .set({ status: 'left' })
      .where(and(eq(queueEntries.roomId, id), eq(queueEntries.seekerClerkId, userId), eq(queueEntries.status, 'waiting')));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, 'DELETE /api/rooms/[id]/queue');
  }
}