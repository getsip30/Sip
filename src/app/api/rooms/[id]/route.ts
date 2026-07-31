import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { rooms, mentors } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.update(rooms)
      .set({ status: 'live', startedAt: new Date() })
      .where(and(eq(rooms.id, id), eq(rooms.status, 'scheduled'), lte(rooms.scheduledAt, new Date())));

    const result = await db
      .select({
        id: rooms.id, title: rooms.title, roomUrl: rooms.roomUrl, status: rooms.status, mode: rooms.mode,
        scheduledAt: rooms.scheduledAt,
        firstName: mentors.firstName, lastName: mentors.lastName, role: mentors.role, company: mentors.company,
        mentorClerkId: mentors.clerkId,
      })
      .from(rooms)
      .innerJoin(mentors, eq(rooms.mentorId, mentors.id))
      .where(eq(rooms.id, id));
    if (!result[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(result[0]);
  } catch (err) {
    return handleApiError(err, 'GET /api/rooms/[id]');
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'No mentor profile' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'start' ? 'start' : 'end';

    const updated = action === 'start'
      ? await db.update(rooms)
          .set({ status: 'live', startedAt: new Date() })
          .where(and(eq(rooms.id, id), eq(rooms.mentorId, mentor.id), eq(rooms.status, 'scheduled')))
          .returning()
      : await db.update(rooms)
          .set({ status: 'ended', endedAt: new Date() })
          .where(and(eq(rooms.id, id), eq(rooms.mentorId, mentor.id)))
          .returning();

    if (!updated[0]) return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });

    return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/rooms/[id]');
  }
}