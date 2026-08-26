import { auth } from '@clerk/nextjs/server';
import { getClerkUser } from '@/lib/clerk';
import { db } from '@/db';
import { seekers, mentors, referralEvents, flags, quizResponses } from '@/db/schema';
import { eq, ne, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { generateUniqueReferralCode } from '@/lib/referral';
import { mutationLimiter, privateReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { recordAbuseSignal } from '@/lib/abuse';
import { safeExternalUrl } from '@/lib/utils';
import { logEvent } from '@/lib/events';
import { mergeInterest } from '@/lib/quiz';
import { logSwallowed } from '@/lib/logger';

/**
 * The caller's own seeker profile, or null when they do not have one.
 *
 * 200 with a null body, NOT 404. "This person has no seeker profile" is a
 * normal, expected answer — every mentor-only account is in that state, and so
 * is every new signup between creating an account and finishing onboarding.
 * 404 means "no such resource at this URL", and using it for an empty result
 * made a routine state look like a broken route: useRoles() calls this and
 * GET /api/mentor on every page for every signed-in user, so a seeker-only
 * account logged a red 404 for /api/mentor, and a brand-new account logged one
 * for both, on every single page load.
 *
 * Every caller already branched on a falsy body rather than on the status, so
 * the change is invisible to them — with one exception that had to be fixed
 * alongside it, see the guard in the mentor dashboard's fetchData.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Was unlimited. useRoles() makes this one of the most-hit authenticated
    // endpoints on the site, and it fans out into a second query below.
    const { success, reset } = await privateReadLimiter.limit(limitKey(req, userId));
    if (!success) return tooManyRequests(reset);

    const result = await db.select().from(seekers).where(eq(seekers.clerkId, userId));
    if (result.length === 0) return NextResponse.json(null);
    const myFlags = await db.select().from(flags).where(and(eq(flags.reportedClerkId, userId), ne(flags.status, 'dismissed')));
    return NextResponse.json({ ...result[0], flags: myFlags });
  } catch (err) {
    return handleApiError(err, 'GET /api/seeker');
  }
}

export async function POST(req: Request) {
  try {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { success } = await mutationLimiter.limit(userId);
  if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

  const { firstName, age, linkedin, interests, avatarData, ref } = await req.json();
  // Explicit integer check: a non-numeric age used to slip past `age < 13` (string
  // comparisons are false) and blow up on the integer column instead.
  if (age !== undefined && age !== null && (!Number.isInteger(age) || age < 13 || age > 100)) {
    return NextResponse.json({ error: 'Please enter a real age between 13 and 100.' }, { status: 400 });
  }
  const safeLinkedin = linkedin ? safeExternalUrl(linkedin) : null;
  if (linkedin && !safeLinkedin) return NextResponse.json({ error: 'LinkedIn must be a valid http(s) URL' }, { status: 400 });
  if (interests && (typeof interests !== 'string' || interests.length > 300)) {
    return NextResponse.json({ error: 'Interests field is too long' }, { status: 400 });
  }
  if (firstName !== undefined && firstName !== null && (typeof firstName !== 'string' || firstName.length > 100)) {
    return NextResponse.json({ error: 'Name is too long' }, { status: 400 });
  }
  if (avatarData && (typeof avatarData !== 'string' || avatarData.length > 256)) {
    return NextResponse.json({ error: 'Invalid avatar' }, { status: 400 });
  }

  const existing = await db.select().from(seekers).where(eq(seekers.clerkId, userId));
  if (existing[0]?.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

  if (existing.length > 0) {
    const updated = await db.update(seekers)
      .set({ firstName: firstName || existing[0].firstName, age, linkedin: safeLinkedin, interests, avatarData: avatarData || null })
      .where(eq(seekers.clerkId, userId))
      .returning();
    return NextResponse.json(updated[0]);
  }

  // Only new profiles need the Clerk record, so this stays off the update path.
  const clerkUser = await getClerkUser(userId);
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress || '';

  /*
   * A name is required to CREATE a seeker, and this is where that becomes true
   * of the data rather than only of the form.
   *
   * The insert below falls back to the Clerk first name and then to '', so a
   * provider profile carrying no given name produced a row with a blank one.
   * The form has always refused to submit without a name, so nothing legitimate
   * reaches here without one; what the fallback actually did was let an
   * incomplete row exist that requireOnboarded then had to catch forever after.
   *
   * Create path only. The update branch above returns early and already keeps
   * the stored name when the field is blank, so editing another field cannot
   * wipe it.
   */
  const createName = (firstName || clerkUser?.firstName || '').trim();
  if (!createName) {
    return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
  }

  let invitedByClerkId: string | null = null;
  if (ref) {
    const referrerSeeker = await db.select().from(seekers).where(eq(seekers.referralCode, ref));
    const referrerMentor = referrerSeeker.length === 0 ? await db.select().from(mentors).where(eq(mentors.referralCode, ref)) : [];
    invitedByClerkId = referrerSeeker[0]?.clerkId || referrerMentor[0]?.clerkId || null;
  }

  /*
   * Someone who came in through the landing-page quiz picked an interest before
   * they had an account, so there was no seekers row to write it to at the time.
   * This is where that row first exists. Deliberately on the INSERT path only:
   * re-running it on the update path would keep re-adding a tag the person had
   * since deliberately removed from their profile.
   *
   * Wrapped, and failing to nothing, because this is a nice-to-have prefill
   * sitting on the critical path of the only route that can create a seeker.
   * It was previously unguarded, and when the quiz_responses table was missing
   * from the database the query threw, the whole POST 500'd, and onboarding
   * became uncompletable for every new user on the site — a cosmetic feature
   * taking out the signup funnel. Nothing about seeding a tag is worth that, so
   * any failure here now costs one prefilled chip and nothing else.
   */
  let seededInterests = interests;
  try {
    const quizRow = await db.select({ interest: quizResponses.interest })
      .from(quizResponses).where(eq(quizResponses.clerkId, userId)).limit(1);
    if (quizRow[0]) seededInterests = mergeInterest(interests, quizRow[0].interest) ?? interests;
  } catch (err) {
    logSwallowed('seeker.quiz_interest_seed_failed', err, { clerkId: userId });
  }

  const referralCode = await generateUniqueReferralCode();
  const created = await db.insert(seekers).values({
    clerkId: userId,
    firstName: createName,
    lastName: clerkUser?.lastName || '',
    email,
    age,
    linkedin: safeLinkedin,
    interests: seededInterests,
    avatarData: avatarData || null,
    referralCode,
    invitedByClerkId,
  }).returning();

  if (invitedByClerkId) {
    await db.insert(referralEvents).values({
      referrerClerkId: invitedByClerkId,
      referredClerkId: userId,
      referredRole: 'seeker',
      milestone: 'signed_up',
    });
  }

  void recordAbuseSignal('signup', limitKey(req, userId), { role: 'seeker' });
  // Below the insert and inside the create branch only: the update branch above
  // returns early, so editing a profile later cannot re-fire this step.
  void logEvent('profile_setup_complete', { clerkId: userId, userRole: 'seeker' });
  return NextResponse.json(created[0]);
  } catch (err) {
    return handleApiError(err, 'POST /api/seeker');
  }
}