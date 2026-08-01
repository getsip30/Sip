import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sipNotes, mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { isUuid } from '@/lib/validate';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const noteResult = await db.select().from(sipNotes).where(eq(sipNotes.id, id));
    const note = noteResult[0];
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    if (mentorResult[0]?.id !== note.mentorId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { status } = await req.json();
    if (!['approved', 'rejected'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

    const updated = await db.update(sipNotes).set({ status }).where(eq(sipNotes.id, id)).returning();
    return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/sip-notes/[id]');
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const noteResult = await db.select().from(sipNotes).where(eq(sipNotes.id, id));
    const note = noteResult[0];
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    if (mentorResult[0]?.id !== note.mentorId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await db.delete(sipNotes).where(eq(sipNotes.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'DELETE /api/sip-notes/[id]');
  }
}