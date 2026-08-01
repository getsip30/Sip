import { db } from '@/db';
import { rooms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';
import { isUuid } from '@/lib/validate';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    const updated = await db.update(rooms).set({ status: 'ended', endedAt: new Date() }).where(eq(rooms.id, id)).returning();
    if (!updated[0]) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'DELETE /api/admin/rooms/[id]');
  }
}
