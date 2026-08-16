import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { takeaways } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { isUuid } from '@/lib/validate';

/**
 * Delete one of your own takeaways.
 *
 * The author check rides in the WHERE clause rather than in a read-then-delete,
 * so there is no window between the two and no way to learn whether an id exists
 * by the shape of the error: someone else's takeaway is a 404 here, exactly like
 * an id that was never real.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Takeaway not found' }, { status: 404 });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const removed = await db.delete(takeaways)
      .where(and(eq(takeaways.id, id), eq(takeaways.authorClerkId, userId)))
      .returning({ id: takeaways.id });

    if (removed.length === 0) return NextResponse.json({ error: 'Takeaway not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, 'DELETE /api/takeaways/[id]');
  }
}
