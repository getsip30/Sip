import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { quizResponses, seekers, mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { isUuid, cleanText } from '@/lib/validate';
import { parseInterest, mergeInterest } from '@/lib/quiz';

/**
 * Attaches a finished quiz to the account that just signed up.
 *
 * Called once, client-side, from /quiz/complete — the page Clerk redirects to
 * after signup. It is the only writer of quiz_responses, and requiring a Clerk
 * session here is what keeps that table off any anonymous write path: the
 * interest travels in a cookie until an account exists to own it.
 *
 * Idempotent. quiz_responses.clerkId is unique and the insert is ON CONFLICT DO
 * NOTHING, so reloading the handoff page, or retrying after a failed request,
 * cannot produce a second row or overwrite the first quiz someone took.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { interest: rawInterest, mentorId, sessionId } = await req.json();

    const interest = parseInterest(rawInterest);
    if (!interest) return NextResponse.json({ error: 'Unknown interest' }, { status: 400 });
    if (mentorId != null && !isUuid(mentorId)) {
      return NextResponse.json({ error: 'Invalid mentorId' }, { status: 400 });
    }

    // Resolved to null rather than trusted, so a mentor deleted between the
    // reveal step and the signup lands as a missing reference instead of a
    // foreign-key violation surfacing as a 500 on someone's first action.
    let resolvedMentorId: string | null = null;
    if (mentorId) {
      const found = await db.select({ id: mentors.id }).from(mentors).where(eq(mentors.id, mentorId)).limit(1);
      resolvedMentorId = found[0]?.id ?? null;
    }

    const inserted = await db.insert(quizResponses).values({
      clerkId: userId,
      interest,
      mentorId: resolvedMentorId,
      sessionId: sessionId == null ? null : cleanText(sessionId, 64),
    }).onConflictDoNothing({ target: quizResponses.clerkId }).returning({ id: quizResponses.id });

    // Empty means this account already claimed a quiz. Everything below is
    // skipped so a reload cannot re-add an interest the person has since
    // removed from their profile.
    //
    // Nothing is logged to the events table here. `signup_complete` is written
    // from the Clerk user.created webhook, which counts every signup rather
    // than only the ones that came through the quiz — see @/lib/events.
    if (inserted.length === 0) return NextResponse.json({ ok: true, alreadyClaimed: true });

    // Only reaches a seeker who has already onboarded — most people arriving
    // here have no seekers row yet, because that row is created by seeker
    // onboarding rather than by signup. The insert path of POST /api/seeker
    // picks the interest up from quiz_responses when it finally creates one.
    const existingSeeker = await db.select({ id: seekers.id, interests: seekers.interests })
      .from(seekers).where(eq(seekers.clerkId, userId)).limit(1);
    if (existingSeeker[0]) {
      const merged = mergeInterest(existingSeeker[0].interests, interest);
      if (merged !== null) {
        await db.update(seekers).set({ interests: merged }).where(eq(seekers.id, existingSeeker[0].id));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, 'POST /api/quiz/claim');
  }
}
