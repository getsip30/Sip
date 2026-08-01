import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { queueEntries, rooms, mentors } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { isUuid } from '@/lib/validate';

async function assertMentorOwnsRoom(userId: string, roomId: string) {
  const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
  const mentor = mentorResult[0];
  if (!mentor) return null;
  const room = await db.select().from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.mentorId, mentor.id)));
  return room[0] ? mentor : null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const mentor = await assertMentorOwnsRoom(userId, id);
    if (!mentor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { entryIds } = await req.json();
    if (!Array.isArray(entryIds) || entryIds.length === 0) return NextResponse.json({ error: 'entryIds required' }, { status: 400 });
    if (entryIds.length > 50) return NextResponse.json({ error: 'Too many entries in one batch' }, { status: 400 });
    if (!entryIds.every(isUuid)) return NextResponse.json({ error: 'Invalid entryIds' }, { status: 400 });

    const updated = await db.update(queueEntries)
      .set({ status: 'active', calledAt: new Date() })
      .where(and(eq(queueEntries.roomId, id), inArray(queueEntries.id, entryIds), eq(queueEntries.status, 'waiting')))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, 'POST /api/rooms/[id]/queue/batch');
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const mentor = await assertMentorOwnsRoom(userId, id);
    if (!mentor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { action } = await req.json();
    if (action !== 'end') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const updated = await db.update(queueEntries)
      .set({ status: 'done', doneAt: new Date() })
      .where(and(eq(queueEntries.roomId, id), eq(queueEntries.status, 'active')))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/rooms/[id]/queue/batch');
  }
}
