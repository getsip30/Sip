import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { requests, mentors, sipFeedback } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { isUuid } from '@/lib/validate';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { rating, comment } = await req.json();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }
    if (comment && comment.length > 1000) return NextResponse.json({ error: 'Comment too long' }, { status: 400 });

    const existing = await db.select().from(requests).where(eq(requests.id, id));
    const r = existing[0];
    if (!r) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (r.status !== 'accepted') return NextResponse.json({ error: 'Sip was not completed' }, { status: 400 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.id, r.mentorId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });

    let role: 'mentor' | 'seeker';
    if (mentor.clerkId === userId) {
      role = 'mentor';
    } else {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const email = user.emailAddresses[0]?.emailAddress;
      if (!email || email.toLowerCase() !== r.seekerEmail.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      role = 'seeker';
    }

    const already = await db.select().from(sipFeedback).where(and(eq(sipFeedback.requestId, id), eq(sipFeedback.role, role)));
    if (already[0]) return NextResponse.json({ error: 'Feedback already submitted' }, { status: 409 });

    const created = await db.insert(sipFeedback).values({
      requestId: id, mentorId: r.mentorId, role, raterClerkId: userId, rating, comment: comment || null,
    }).returning();

    return NextResponse.json(created[0]);
  } catch (err) {
    return handleApiError(err, 'POST /api/requests/[id]/feedback');
  }
}