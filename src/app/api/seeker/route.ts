import { auth } from '@clerk/nextjs/server';
import { getClerkUser } from '@/lib/clerk';
import { db } from '@/db';
import { seekers, mentors, referralEvents, flags } from '@/db/schema';
import { eq, ne, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { generateUniqueReferralCode } from '@/lib/referral';
import { mutationLimiter, limitKey } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { recordAbuseSignal } from '@/lib/abuse';
import { safeExternalUrl } from '@/lib/utils';
import { logEvent } from '@/lib/events';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await db.select().from(seekers).where(eq(seekers.clerkId, userId));
    if (result.length === 0) return NextResponse.json(null, { status: 404 });
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

  let invitedByClerkId: string | null = null;
  if (ref) {
    const referrerSeeker = await db.select().from(seekers).where(eq(seekers.referralCode, ref));
    const referrerMentor = referrerSeeker.length === 0 ? await db.select().from(mentors).where(eq(mentors.referralCode, ref)) : [];
    invitedByClerkId = referrerSeeker[0]?.clerkId || referrerMentor[0]?.clerkId || null;
  }

  const referralCode = await generateUniqueReferralCode();
  const created = await db.insert(seekers).values({
    clerkId: userId,
    firstName: firstName || clerkUser?.firstName || '',
    lastName: clerkUser?.lastName || '',
    email,
    age,
    linkedin: safeLinkedin,
    interests,
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