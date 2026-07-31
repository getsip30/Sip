import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { requests, mentors, sipFeedback } from '@/db/schema';
import { eq, and, getTableColumns, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const result = rows.map(r => ({ ...r, mentorFeedbackGiven: r.mentorFeedbackGiven !== null }));
  return NextResponse.json(result.reverse());
}
