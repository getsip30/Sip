import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { queueEntries, rooms, mentors } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';

async function assertMentorOwnsRoom(userId: string, roomId: string) {
  const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
  const mentor = mentorResult[0];
  if (!mentor) return null;
  const room = await db.select().from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.mentorId, mentor.id)));
  return room[0] ? mentor : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  try {
    const { id, entryId } = await params;
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const mentor = await assertMentorOwnsRoom(userId, id);
    if (!mentor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { action } = await req.json();
    if (!['call', 'done'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    if (action === 'call') {
      // single atomic statement: end whoever's active (except this entry) AND activate this entry,
      // in one round trip so a second concurrent "call" can't split the two writes apart
      const result = await db.execute(sql`
        WITH ended AS (
          UPDATE queue_entries
          SET status = 'done', done_at = now()
          WHERE room_id = ${id} AND status = 'active' AND id != ${entryId}
        )
        UPDATE queue_entries
        SET status = 'active', called_at = now()
        WHERE id = ${entryId} AND room_id = ${id} AND status = 'waiting'
        RETURNING *;
      `);

      const updated = result.rows?.[0];
      if (!updated) return NextResponse.json({ error: 'Entry not found or not waiting' }, { status: 404 });
      return NextResponse.json(updated);
    }

    const updated = await db.update(queueEntries)
      .set({ status: 'done', doneAt: new Date() })
      .where(and(eq(queueEntries.id, entryId), eq(queueEntries.roomId, id)))
      .returning();

    if (!updated[0]) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/rooms/[id]/queue/[entryId]');
  }
}