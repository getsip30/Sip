import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sessionNotes, mentors, rooms, queueEntries, seekers } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter, privateReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { isUuid, cleanText } from '@/lib/validate';

const MAX_NOTE = 2000;

/**
 * A mentor's own session notes, newest session first. These are private to the
 * mentor who wrote them: there is deliberately no route that lets a seeker read
 * notes written about them, and no mentorId parameter, so a caller can only ever
 * reach their own rows.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success, reset } = await privateReadLimiter.limit(limitKey(req, userId));
    if (!success) return tooManyRequests(reset);

    const mentorRow = await db.select({ id: mentors.id }).from(mentors).where(eq(mentors.clerkId, userId));
    if (mentorRow.length === 0) return NextResponse.json([]);

    const rows = await db
      .select({
        id: sessionNotes.id,
        sessionId: sessionNotes.sessionId,
        seekerClerkId: sessionNotes.seekerClerkId,
        seekerName: sessionNotes.seekerName,
        sessionDate: sessionNotes.sessionDate,
        noteText: sessionNotes.noteText,
        createdAt: sessionNotes.createdAt,
      })
      .from(sessionNotes)
      .where(eq(sessionNotes.mentorId, mentorRow[0].id))
      .orderBy(desc(sessionNotes.sessionDate), desc(sessionNotes.createdAt))
      .limit(500);

    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err, 'GET /api/session-notes');
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { roomId, seekerClerkId, noteText } = await req.json();
    if (!isUuid(roomId)) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    if (typeof seekerClerkId !== 'string' || !seekerClerkId.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const note = cleanText(noteText, MAX_NOTE);
    if (!note) return NextResponse.json({ error: 'Write something first.' }, { status: 400 });

    const roomRow = await db.select().from(rooms).where(eq(rooms.id, roomId));
    const room = roomRow[0];
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const mentorRow = await db.select().from(mentors).where(eq(mentors.id, room.mentorId));
    const mentor = mentorRow[0];
    if (!mentor || mentor.clerkId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (mentor.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    // Same gate as POST connect-request: without it a mentor could write notes
    // against any clerkId they happened to know rather than only the people who
    // actually turned up in their room.
    const attended = await db.select({ id: queueEntries.id }).from(queueEntries)
      .where(and(eq(queueEntries.roomId, roomId), eq(queueEntries.seekerClerkId, seekerClerkId)));
    if (attended.length === 0) {
      return NextResponse.json({ error: 'That person was not in this room.' }, { status: 403 });
    }

    // Name resolved server-side rather than taken from the body, so a note
    // cannot be filed under a name the caller made up.
    const seekerRow = await db.select({ firstName: seekers.firstName, lastName: seekers.lastName })
      .from(seekers).where(eq(seekers.clerkId, seekerClerkId));
    const fromProfile = seekerRow[0]
      ? [seekerRow[0].firstName, seekerRow[0].lastName].filter(Boolean).join(' ')
      : '';
    const queueName = await db.select({ seekerName: queueEntries.seekerName }).from(queueEntries)
      .where(and(eq(queueEntries.roomId, roomId), eq(queueEntries.seekerClerkId, seekerClerkId)))
      .limit(1);
    const seekerName = fromProfile || queueName[0]?.seekerName || 'Someone';

    const created = await db.insert(sessionNotes).values({
      mentorId: mentor.id,
      sessionId: room.id,
      seekerClerkId,
      seekerName,
      // The session's own date, not write time, so a note written afterwards
      // still groups under the session it belongs to.
      sessionDate: room.startedAt,
      noteText: note,
    }).returning();

    return NextResponse.json(created[0]);
  } catch (err) {
    return handleApiError(err, 'POST /api/session-notes');
  }
}
