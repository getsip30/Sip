import { db } from '@/db';
import { sessionFeedback, mentors, rooms } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';

/**
 * The only way to read session feedback. Both sides answer honestly on the
 * understanding that the other never sees it, so this stays behind the admin
 * check and has no counterpart route for mentors or seekers.
 */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const rows = await db
      .select({
        id: sessionFeedback.id,
        role: sessionFeedback.role,
        rating: sessionFeedback.rating,
        wouldSipAgain: sessionFeedback.wouldSipAgain,
        comment: sessionFeedback.comment,
        createdAt: sessionFeedback.createdAt,
        seekerClerkId: sessionFeedback.seekerClerkId,
        roomTitle: rooms.title,
        mentorFirstName: mentors.firstName,
        mentorLastName: mentors.lastName,
      })
      .from(sessionFeedback)
      .leftJoin(mentors, eq(sessionFeedback.mentorId, mentors.id))
      .leftJoin(rooms, eq(sessionFeedback.roomId, rooms.id))
      .orderBy(desc(sessionFeedback.createdAt))
      .limit(500);

    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err, 'GET /api/admin/session-feedback');
  }
}
