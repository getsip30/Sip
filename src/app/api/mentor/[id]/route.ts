import { db } from '@/db';
import { mentors } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { publicReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { publicMentor } from '@/lib/mentor';
import { isUuid } from '@/lib/validate';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { success, reset } = await publicReadLimiter.limit(limitKey(req));
  if (!success) return tooManyRequests(reset);

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json(null, { status: 404 });
  // This route served banned mentors, which the SSR profile page at
  // /mentors/[id] has refused to do for a while — same data, two answers.
  const result = await db.select().from(mentors)
    .where(and(eq(mentors.id, id), eq(mentors.banned, false), isNull(mentors.deletedAt)));
  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(publicMentor(result[0]));
}