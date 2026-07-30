import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { requests } from '@/db/schema';
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

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) return NextResponse.json({ error: 'No email on file' }, { status: 400 });

    const { scheduledAt } = await req.json();
    if (!scheduledAt || isNaN(Date.parse(scheduledAt))) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    if (new Date(scheduledAt).getTime() < Date.now() + 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Pick a time at least an hour from now' }, { status: 400 });
    }

    const existing = await db.select().from(requests).where(eq(requests.id, id));
    const r = existing[0];
    if (!r) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (r.seekerEmail.toLowerCase() !== email.toLowerCase()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (r.status !== 'accepted') return NextResponse.json({ error: 'Request is not accepted' }, { status: 400 });

    const requestedTime = new Date(scheduledAt).getTime();
    const mentorOtherSips = await db.select().from(requests).where(and(eq(requests.mentorId, r.mentorId), eq(requests.status, 'accepted')));
    const overlaps = mentorOtherSips.some(other => {
      if (other.id === id || !other.scheduledAt) return false;
      const gap = Math.abs(new Date(other.scheduledAt).getTime() - requestedTime);
      return gap < 30 * 60 * 1000;
    });
    if (overlaps) {
      return NextResponse.json({ error: 'This mentor already has a sip scheduled too close to that time. Pick another slot.' }, { status: 409 });
    }

    const updated = await db.update(requests)
      .set({ scheduledAt: new Date(scheduledAt), reminderSentAt: null })
      .where(eq(requests.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/requests/[id]/schedule');
  }
}