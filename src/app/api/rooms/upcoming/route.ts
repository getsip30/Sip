import { db } from '@/db';
import { rooms, mentors } from '@/db/schema';
import { eq, and, gt, lte, asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { readLimiter, getIp } from '@/lib/ratelimit';

export async function GET(req: Request) {
  try {
    const ip = getIp(req);
    const { success } = await readLimiter.limit(ip);
    if (!success) return NextResponse.json({ error: 'Slow down a bit.' }, { status: 429 });

    await db.update(rooms)
      .set({ status: 'live', startedAt: new Date() })
      .where(and(eq(rooms.status, 'scheduled'), lte(rooms.scheduledAt, new Date())));

    const result = await db
      .select({
        id: rooms.id, title: rooms.title, scheduledAt: rooms.scheduledAt,
        mentorId: mentors.id, firstName: mentors.firstName, lastName: mentors.lastName,
        role: mentors.role, company: mentors.company, avatarData: mentors.avatarData,
      })
      .from(rooms)
      .innerJoin(mentors, eq(rooms.mentorId, mentors.id))
      .where(and(eq(rooms.status, 'scheduled'), gt(rooms.scheduledAt, new Date())))
      .orderBy(asc(rooms.scheduledAt))
      .limit(100);

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'GET /api/rooms/upcoming');
  }
}