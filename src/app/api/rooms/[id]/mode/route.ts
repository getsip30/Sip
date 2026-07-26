import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { rooms, mentors } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { mode } = await req.json();
    if (!['individual', 'batch'].includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'No mentor profile' }, { status: 403 });

    const updated = await db.update(rooms).set({ mode })
      .where(and(eq(rooms.id, id), eq(rooms.mentorId, mentor.id)))
      .returning();

    if (!updated[0]) return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });
    return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/rooms/[id]/mode');
  }
}
