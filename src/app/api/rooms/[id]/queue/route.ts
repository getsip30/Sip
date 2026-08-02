import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { queueEntries, rooms, seekers, flags, mentors, requests } from '@/db/schema';
import { eq, and, sql, inArray, ne, lt } from 'drizzle-orm';
import { NextResponse, after } from 'next/server';
import { runOnce } from '@/lib/lock';
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

    // Every viewer polls this every 4s, so the stale-entry sweep runs behind a
    // per-room lock and off the response path rather than on every request.
    after(() =>
      runOnce(`queue:sweep:${id}`, 60, async () => {
        const staleCutoff = new Date(Date.now() - STALE_WAITING_MS);
        await db.update(queueEntries).set({ status: 'left' })
          .where(and(eq(queueEntries.roomId, id), eq(queueEntries.status, 'waiting'), lt(queueEntries.joinedAt, staleCutoff)));
      })
    );

    // The room (and its owner) is resolved once, joined, rather than being
    // re-fetched separately for the counts and for the viewer check.
    const [entries, roomRow] = await Promise.all([
      db.select().from(queueEntries)
        .where(and(eq(queueEntries.roomId, id), inArray(queueEntries.status, ['waiting', 'active', 'done'])))
        .orderBy(queueEntries.joinedAt),
      db.select({ mentorId: rooms.mentorId, mentorClerkId: mentors.clerkId })
        .from(rooms)
        .innerJoin(mentors, eq(rooms.mentorId, mentors.id))
        .where(eq(rooms.id, id)),
    ]);

    const result = entries.filter(e => e.status === 'waiting');
    const active = entries.filter(e => e.status === 'active');
    const done = entries
      .filter(e => e.status === 'done')
      .sort((a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0))
      .slice(0, 50);

    const allEntries = [...result, ...active, ...done];
    const clerkIds = [...new Set(allEntries.map(e => e.seekerClerkId).filter(Boolean))] as string[];

    const viewerIsMentor = !!viewerId && roomRow[0]?.mentorClerkId === viewerId;

    let visitCounts: Record<string, number> = {};
    let flagCounts: Record<string, number> = {};
    const connectStatuses: Record<string, string> = {};

    // These aggregates are only ever rendered for the host, so skip the work
    // entirely for the seekers who make up nearly all of this route's traffic.
    if (viewerIsMentor && clerkIds.length > 0) {
      const mentorId = roomRow[0]?.mentorId;
      const [visits, flagRows, connectRows] = await Promise.all([
        mentorId
          ? db.select({ seekerClerkId: queueEntries.seekerClerkId, count: sql<number>`count(*)::int` })
              .from(queueEntries)
              .innerJoin(rooms, eq(queueEntries.roomId, rooms.id))
              .where(and(eq(rooms.mentorId, mentorId), inArray(queueEntries.seekerClerkId, clerkIds)))
              .groupBy(queueEntries.seekerClerkId)
          : Promise.resolve([]),
        db.select({ reportedClerkId: flags.reportedClerkId, count: sql<number>`count(*)::int` })
          .from(flags)
          .where(and(inArray(flags.reportedClerkId, clerkIds), ne(flags.status, 'dismissed')))
          .groupBy(flags.reportedClerkId),
        // Drives the "request 1:1" button label. Deriving it server-side means
        // the 4s poll already carries the answer, so the button reverts on its
        // own once a request is declined or cancelled.
        mentorId
          ? db.select({ seekerClerkId: requests.seekerClerkId, status: requests.status, sipCountedAt: requests.sipCountedAt })
              .from(requests)
              .where(and(eq(requests.mentorId, mentorId), inArray(requests.seekerClerkId, clerkIds)))
          : Promise.resolve([]),
      ]);
      visitCounts = Object.fromEntries(visits.map(v => [v.seekerClerkId as string, v.count]));
      flagCounts = Object.fromEntries(flagRows.map(f => [f.reportedClerkId as string, f.count]));

      // "Open" has to mean the same thing here as in POST connect-request, which
      // rejects a duplicate with a 409. If these two drifted apart the button
      // would invite a click that always failed.
      for (const r of connectRows) {
        if (!r.seekerClerkId) continue;
        const open = r.status === 'pending' || (r.status === 'accepted' && !r.sipCountedAt);
        if (!open) continue;
        // accepted outranks pending when a seeker somehow has both.
        if (r.status === 'accepted' || !connectStatuses[r.seekerClerkId]) {
          connectStatuses[r.seekerClerkId] = r.status;
        }
      }
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
        connectStatus: (e.seekerClerkId ? connectStatuses[e.seekerClerkId] : null) ?? 'none',
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