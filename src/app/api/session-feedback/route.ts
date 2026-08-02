import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sessionFeedback, rooms, mentors, queueEntries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { isUuid, cleanText } from '@/lib/validate';

/**
 * Private post-session feedback for a live room. There is no GET here on
 * purpose: this is admin-only data, read through /api/admin/session-feedback,
 * and neither side of a session can read what the other said about them.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { roomId, seekerClerkId, rating, wouldSipAgain, comment } = await req.json();
    if (!isUuid(roomId)) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1 to 5' }, { status: 400 });
    }
    if (wouldSipAgain !== undefined && wouldSipAgain !== null && typeof wouldSipAgain !== 'boolean') {
      return NextResponse.json({ error: 'Invalid value for would sip again' }, { status: 400 });
    }
    const cleanComment = comment ? cleanText(comment, 1000) : null;
    if (comment && !cleanComment) {
      return NextResponse.json({ error: 'Comment is too long' }, { status: 400 });
    }

    const roomRow = await db.select().from(rooms).where(eq(rooms.id, roomId));
    const room = roomRow[0];
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const mentorRow = await db.select().from(mentors).where(eq(mentors.id, room.mentorId));
    const mentor = mentorRow[0];
    if (!mentor) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const isMentor = mentor.clerkId === userId;

    // Whichever side is rating, the pair has to have actually met in this room.
    // The mentor names the seeker they are rating; a seeker can only rate their
    // own session, so their own id is used rather than anything from the body.
    const counterpartId = isMentor ? seekerClerkId : userId;
    if (typeof counterpartId !== 'string' || !counterpartId.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const attended = await db.select({ id: queueEntries.id }).from(queueEntries)
      .where(and(
        eq(queueEntries.roomId, roomId),
        eq(queueEntries.seekerClerkId, counterpartId),
        eq(queueEntries.status, 'done'),
      ));
    if (attended.length === 0) {
      return NextResponse.json({ error: 'No finished session to rate here.' }, { status: 403 });
    }

    try {
      const created = await db.insert(sessionFeedback).values({
        roomId,
        mentorId: mentor.id,
        seekerClerkId: counterpartId,
        role: isMentor ? 'mentor' : 'seeker',
        raterClerkId: userId,
        rating,
        wouldSipAgain: typeof wouldSipAgain === 'boolean' ? wouldSipAgain : null,
        comment: cleanComment,
      }).returning({ id: sessionFeedback.id });
      return NextResponse.json({ id: created[0].id });
    } catch (err: unknown) {
      // Unique index on room + seeker + role. Already rated is not an error
      // worth showing anyone, so it resolves to the same end state.
      if ((err as { code?: string })?.code === '23505') {
        return NextResponse.json({ alreadySubmitted: true });
      }
      throw err;
    }
  } catch (err) {
    return handleApiError(err, 'POST /api/session-feedback');
  }
}
