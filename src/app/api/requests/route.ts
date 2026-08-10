import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { requests, mentors, sipFeedback } from '@/db/schema';
import { eq, and, getTableColumns, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { privateReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { success, reset } = await privateReadLimiter.limit(limitKey(req, userId));
    if (!success) return tooManyRequests(reset);


  const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
  if (mentorResult.length === 0) return NextResponse.json([]);

  const mentor = mentorResult[0];
  const rows = await db
    .select({
      ...getTableColumns(requests),
      mentorFeedbackGiven: sipFeedback.id,
    })
    .from(requests)
    .leftJoin(sipFeedback, and(eq(sipFeedback.requestId, requests.id), eq(sipFeedback.role, 'mentor')))
    .where(eq(requests.mentorId, mentor.id))
    .orderBy(desc(requests.createdAt))
    .limit(300);

  // confirmToken is the bearer secret behind the seeker's "still coming?" link.
  // getTableColumns pulls in every column, so it has to be dropped explicitly —
  // otherwise the mentor's own dashboard hands them a token that lets them
  // answer on the seeker's behalf.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const result = rows.map(({ confirmToken: _confirmToken, ...r }) => ({
    ...r,
    mentorFeedbackGiven: r.mentorFeedbackGiven !== null,
  }));
  return NextResponse.json(result.reverse());
}
