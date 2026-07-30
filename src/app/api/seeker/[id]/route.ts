import { db } from "@/db";
import { seekers, requests, mentors } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json(null, { status: 404 });
  const result = await db.select().from(seekers).where(eq(seekers.id, id));
  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  const seeker = result[0];

  const sharedSips = await db.select().from(requests).where(and(
    eq(requests.seekerClerkId, seeker.clerkId),
    eq(requests.status, "accepted"),
    eq(requests.seekerConsentToShow, true),
    eq(requests.mentorConsentToShow, true)
  ));

  const sips = [];
  for (const s of sharedSips) {
    const m = await db.select().from(mentors).where(eq(mentors.id, s.mentorId));
    if (m[0]) sips.push({ mentorId: m[0].id, firstName: m[0].firstName, lastName: m[0].lastName, role: m[0].role, company: m[0].company });
  }

  const { clerkId, email, invitedByClerkId, linkedin, ...safe } = seeker;
  return NextResponse.json({ ...safe, sips });
}