import { db } from '@/db';
import { seekers, mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * Loads the caller's seeker profile and refuses if it is missing or banned.
 *
 * The pattern this replaces was `if (row[0]?.banned) reject`, which passes when
 * there is no row at all. That made two things true at once: someone who never
 * finished onboarding could still create requests, asks and queue entries with
 * no profile behind them, and because a ban is a flag on the seekers row, a user
 * with no row could not be banned. Never onboarding was a way to opt out of
 * moderation while keeping most of the app.
 *
 * Returning the row rather than a boolean means callers stop re-querying it, so
 * the check cannot be skipped by forgetting to look.
 */
export async function requireSeeker(userId: string) {
  const rows = await db.select().from(seekers).where(eq(seekers.clerkId, userId)).limit(1);
  const seeker = rows[0];

  if (!seeker) {
    return {
      seeker: null,
      error: NextResponse.json(
        { error: 'Finish setting up your seeker profile first.', needsOnboarding: 'seeker' },
        { status: 403 }
      ),
    };
  }
  if (seeker.banned) {
    return {
      seeker: null,
      error: NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 }),
    };
  }
  return { seeker, error: null as null };
}

/** The mentor equivalent, for the same reason. */
export async function requireMentor(userId: string) {
  const rows = await db.select().from(mentors).where(eq(mentors.clerkId, userId)).limit(1);
  const mentor = rows[0];

  if (!mentor) {
    return {
      mentor: null,
      error: NextResponse.json(
        { error: 'Finish setting up your mentor profile first.', needsOnboarding: 'mentor' },
        { status: 403 }
      ),
    };
  }
  if (mentor.banned) {
    return {
      mentor: null,
      error: NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 }),
    };
  }
  return { mentor, error: null as null };
}
