import { db } from "@/db";
import { seekers, requests, mentors } from "@/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { publicReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';

import { isUuid } from '@/lib/validate';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { success, reset } = await publicReadLimiter.limit(limitKey(req));
  if (!success) return tooManyRequests(reset);

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json(null, { status: 404 });
  const result = await db.select().from(seekers).where(and(eq(seekers.id, id), isNull(seekers.deletedAt)));
  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  const seeker = result[0];

  const sharedSips = await db.select().from(requests).where(and(
    eq(requests.seekerClerkId, seeker.clerkId),
    eq(requests.status, "accepted"),
    eq(requests.seekerConsentToShow, true),
    eq(requests.mentorConsentToShow, true)
  ));

  // One query for every shared sip's mentor instead of one per sip.
  const mentorIds = [...new Set(sharedSips.map((s) => s.mentorId))];
  const sips = mentorIds.length
    ? await db
        .select({ mentorId: mentors.id, firstName: mentors.firstName, lastName: mentors.lastName, role: mentors.role, company: mentors.company })
        .from(mentors)
        .where(inArray(mentors.id, mentorIds))
    : [];

  // An ALLOWLIST, matching publicMentor. This used to strip four named fields
  // and spread the rest, so every column added to seekers afterwards was
  // published by default. On this unauthenticated route that was already
  // leaking referralCode, which is unique and drives referral attribution,
  // banned, which is moderation state, and the lastNoteAt / lastMatchEmailAt /
  // lastCheckinAt activity timestamps. Anything new stays private until someone
  // deliberately adds it here.
  return NextResponse.json({
    id: seeker.id,
    firstName: seeker.firstName,
    lastName: seeker.lastName,
    age: seeker.age,
    interests: seeker.interests,
    avatarData: seeker.avatarData,
    currentStreak: seeker.currentStreak,
    longestStreak: seeker.longestStreak,
    createdAt: seeker.createdAt,
    sips,
  });
}