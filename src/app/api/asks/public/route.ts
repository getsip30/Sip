import { db } from '@/db';
import { asks, mentors } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { publicReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';

export async function GET(req: Request) {
  try {
    const { success, reset } = await publicReadLimiter.limit(limitKey(req));
    if (!success) return tooManyRequests(reset);

    const result = await db
      .select({
        id: asks.id,
        question: asks.question,
        answer: asks.answer,
        seekerFirstName: asks.seekerName,
        answeredAt: asks.answeredAt,
        mentorId: mentors.id,
        mentorFirstName: mentors.firstName,
        mentorLastName: mentors.lastName,
        mentorRole: mentors.role,
        mentorCompany: mentors.company,
      })
      .from(asks)
      .innerJoin(mentors, eq(asks.mentorId, mentors.id))
      .where(and(eq(asks.status, 'answered'), eq(asks.seekerConsentToShow, true), eq(asks.mentorConsentToShow, true)))
      .orderBy(desc(asks.answeredAt))
      .limit(50);

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'GET /api/asks/public');
  }
}
