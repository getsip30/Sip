import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { consents } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { isUuid } from '@/lib/validate';

/**
 * Has this user already agreed to a given context?
 *
 * The message gate used to be pure client state, so it re-prompted on every
 * single send, forever, and recorded nothing. Reading the row back lets it ask
 * once and stay asked — the same shape the call gate already writes.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ consented: false });

    const url = new URL(req.url);
    const context = url.searchParams.get('context');
    const roomId = url.searchParams.get('roomId');
    if (context !== 'call' && context !== 'message') {
      return NextResponse.json({ error: 'Invalid context' }, { status: 400 });
    }
    if (roomId != null && !isUuid(roomId)) {
      return NextResponse.json({ error: 'Invalid roomId' }, { status: 400 });
    }

    const conditions = [eq(consents.clerkId, userId), eq(consents.context, context)];
    conditions.push(roomId ? eq(consents.roomId, roomId) : isNull(consents.roomId));
    const existing = await db.select().from(consents).where(and(...conditions)).limit(1);

    return NextResponse.json({ consented: !!existing[0] });
  } catch (err) {
    return handleApiError(err, 'GET /api/consent');
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { roomId, context } = await req.json();
    if (!context || (context !== 'call' && context !== 'message')) {
      return NextResponse.json({ error: 'Invalid context' }, { status: 400 });
    }
    if (roomId != null && !isUuid(roomId)) {
      return NextResponse.json({ error: 'Invalid roomId' }, { status: 400 });
    }

    // One consent record per user/room/context. The gate is client-side state, so
    // it re-prompts on every page load and used to insert a row each time.
    const conditions = [eq(consents.clerkId, userId), eq(consents.context, context)];
    conditions.push(roomId ? eq(consents.roomId, roomId) : isNull(consents.roomId));
    const existing = await db.select().from(consents).where(and(...conditions)).limit(1);
    if (existing[0]) return NextResponse.json(existing[0]);

    const [consent] = await db.insert(consents).values({
      clerkId: userId,
      roomId: roomId || null,
      context,
    }).returning();

    return NextResponse.json(consent);
  } catch (err) {
    return handleApiError(err, 'POST /api/consent');
  }
}
