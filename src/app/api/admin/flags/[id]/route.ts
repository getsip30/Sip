import { db } from '@/db';
import { flags } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';
import { isUuid } from '@/lib/validate';
import { mentors, seekers } from '@/db/schema';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
    const { action } = await req.json(); // 'dismiss' | 'action' | 'ban'
    if (!['dismiss', 'action', 'ban'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const updated = await db.update(flags)
      .set({ status: action === 'dismiss' ? 'dismissed' : 'actioned', resolvedAt: new Date() })
      .where(eq(flags.id, id))
      .returning();

    if (action === 'ban' && updated[0]) {
      await db.update(mentors).set({ banned: true }).where(eq(mentors.clerkId, updated[0].reportedClerkId));
      await db.update(seekers).set({ banned: true }).where(eq(seekers.clerkId, updated[0].reportedClerkId));
    }

    return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/admin/flags/[id]');
  }
}