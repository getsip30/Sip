import { db } from '@/db';
import { mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';
import { isUuid } from '@/lib/validate';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    const { banned } = await req.json();
    if (typeof banned !== 'boolean') return NextResponse.json({ error: 'banned must be true or false' }, { status: 400 });

    const updated = await db.update(mentors).set({ banned }).where(eq(mentors.id, id)).returning();
    if (!updated[0]) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/admin/mentors/[id]');
  }
}
