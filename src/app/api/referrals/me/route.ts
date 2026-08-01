import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { referralEvents, seekers, mentors } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { privateReadLimiter, limitKey, tooManyRequests } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { success, reset } = await privateReadLimiter.limit(limitKey(req, userId));
  if (!success) return tooManyRequests(reset);

  const signups = await db.select().from(referralEvents).where(and(
    eq(referralEvents.referrerClerkId, userId),
    eq(referralEvents.milestone, "signed_up")
  ));

  const bookings = await db.select().from(referralEvents).where(and(
    eq(referralEvents.referrerClerkId, userId),
    eq(referralEvents.milestone, "first_sip_booked")
  ));
  const bookedIds = new Set(bookings.map(b => b.referredClerkId));

  // Resolve every referred person in two queries rather than two per signup.
  const referredIds = signups.map((s) => s.referredClerkId);
  const [referredSeekers, referredMentors] = referredIds.length
    ? await Promise.all([
        db.select({ clerkId: seekers.clerkId, firstName: seekers.firstName, lastName: seekers.lastName })
          .from(seekers).where(inArray(seekers.clerkId, referredIds)),
        db.select({ clerkId: mentors.clerkId, firstName: mentors.firstName, lastName: mentors.lastName })
          .from(mentors).where(inArray(mentors.clerkId, referredIds)),
      ])
    : [[], []];

  const byClerkId = new Map<string, { firstName: string; lastName: string }>();
  for (const m of referredMentors) byClerkId.set(m.clerkId, m);
  for (const s of referredSeekers) byClerkId.set(s.clerkId, s);

  const chain = signups.map((s) => {
    const person = byClerkId.get(s.referredClerkId);
    return {
      clerkId: s.referredClerkId,
      firstName: person?.firstName || "Unknown",
      lastName: person?.lastName || "",
      role: s.referredRole,
      convertedToSip: bookedIds.has(s.referredClerkId),
    };
  });

  const [mySeeker, myMentor] = await Promise.all([
    db.select({ referralCode: seekers.referralCode }).from(seekers).where(eq(seekers.clerkId, userId)),
    db.select({ referralCode: mentors.referralCode }).from(mentors).where(eq(mentors.clerkId, userId)),
  ]);
  const referralCode = mySeeker[0]?.referralCode || myMentor[0]?.referralCode || null;

  return NextResponse.json({
    referralCode,
    totalInvites: chain.length,
    totalConverted: chain.filter(c => c.convertedToSip).length,
    chain,
  });
}
