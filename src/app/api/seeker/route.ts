import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { seekers, mentors, referralEvents, flags } from '@/db/schema';
import { eq, ne, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { generateReferralCode } from '@/lib/referral';
import { mutationLimiter } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';

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

  const { firstName, age, linkedin, interests, ref } = await req.json();
  if (age !== undefined && age !== null && (age < 13 || age > 100)) {
    return NextResponse.json({ error: 'Please enter a real age between 13 and 100.' }, { status: 400 });
  }
  if (linkedin && linkedin.length > 200) return NextResponse.json({ error: 'LinkedIn URL is too long' }, { status: 400 });
  if (interests && interests.length > 300) return NextResponse.json({ error: 'Interests field is too long' }, { status: 400 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.emailAddresses[0]?.emailAddress || '';

  const existing = await db.select().from(seekers).where(eq(seekers.clerkId, userId));
  if (existing.length > 0) {
    const updated = await db.update(seekers)
      .set({ firstName: firstName || existing[0].firstName, age, linkedin, interests })
      .where(eq(seekers.clerkId, userId))
      .returning();
    return NextResponse.json(updated[0]);
  }

  let invitedByClerkId: string | null = null;
  if (ref) {
    const referrerSeeker = await db.select().from(seekers).where(eq(seekers.referralCode, ref));
    const referrerMentor = referrerSeeker.length === 0 ? await db.select().from(mentors).where(eq(mentors.referralCode, ref)) : [];
    invitedByClerkId = referrerSeeker[0]?.clerkId || referrerMentor[0]?.clerkId || null;
  }

  const created = await db.insert(seekers).values({
    clerkId: userId,
    firstName: firstName || user.firstName || '',
    lastName: user.lastName || '',
    email,
    age,
    linkedin,
    interests,
    referralCode: generateReferralCode(),
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

  return NextResponse.json(created[0]);
  } catch (err) {
    return handleApiError(err, 'POST /api/seeker');
  }
}