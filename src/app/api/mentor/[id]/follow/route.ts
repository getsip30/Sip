import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { follows, seekers } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { isUuid } from '@/lib/validate';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    const { userId } = await auth();

    const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(follows).where(eq(follows.mentorId, id));
    const count = countResult[0]?.count || 0;

    let following = false;
    if (userId) {
      const existing = await db.select().from(follows).where(and(eq(follows.mentorId, id), eq(follows.seekerClerkId, userId)));
      following = existing.length > 0;
    }

    return NextResponse.json({ following, count });
  } catch (err) {
    return handleApiError(err, 'GET /api/mentor/[id]/follow');
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const seekerCheck = await db.select().from(seekers).where(eq(seekers.clerkId, userId));
    if (seekerCheck[0]?.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    try {
      await db.insert(follows).values({ seekerClerkId: userId, mentorId: id });
    } catch (insertErr: any) {
      if (insertErr?.code !== '23505') throw insertErr;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, 'POST /api/mentor/[id]/follow');
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await db.delete(follows).where(and(eq(follows.mentorId, id), eq(follows.seekerClerkId, userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, 'DELETE /api/mentor/[id]/follow');
  }
}
