import { db } from '@/db';
import { sipNotes, mentors } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { readLimiter, getIp } from '@/lib/ratelimit';

/**
 * Mentor-approved notes for the marketing page. Only notes the mentor has
 * explicitly approved for public display are eligible, and no seeker email or
 * clerk id is selected.
 */
export async function GET(req: Request) {
  try {
    const { success } = await readLimiter.limit(getIp(req));
    if (!success) return NextResponse.json([], { status: 429 });

    const result = await db
      .select({
        id: sipNotes.id,
        note: sipNotes.note,
        seekerName: sipNotes.seekerName,
        createdAt: sipNotes.createdAt,
        mentorId: mentors.id,
        mentorFirstName: mentors.firstName,
        mentorLastName: mentors.lastName,
        mentorRole: mentors.role,
        mentorCompany: mentors.company,
      })
      .from(sipNotes)
      .innerJoin(mentors, eq(sipNotes.mentorId, mentors.id))
      .where(and(eq(sipNotes.status, 'approved'), eq(mentors.banned, false)))
      .orderBy(desc(sipNotes.createdAt))
      .limit(6);

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'GET /api/sip-notes/featured');
  }
}
