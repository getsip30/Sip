import { db } from "@/db";
import { seekers, requests, mentors } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { publicReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';

import { isUuid } from '@/lib/validate';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { success, reset } = await publicReadLimiter.limit(limitKey(req));
  if (!success) return tooManyRequests(reset);

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json(null, { status: 404 });
  const result = await db.select().from(seekers).where(eq(seekers.id, id));
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

  const { clerkId, email, invitedByClerkId, linkedin, ...safe } = seeker;
  return NextResponse.json({ ...safe, sips });
}