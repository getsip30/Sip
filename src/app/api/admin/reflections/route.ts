import { db } from '@/db';
import { reflections, mentors, seekers, requests } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';

/**
 * Reflections the seeker ticked "okay to share publicly".
 *
 * Admin-only, and the ONLY route that reads reflections back at all. `shareable`
 * is permission to be quoted somewhere a human chooses, not permission to be
 * published automatically, so there is deliberately no public counterpart to
 * this yet — the answers are read here and used by hand.
 *
 * The filter is in the WHERE clause rather than in the page. An admin surface
 * that fetched every reflection and hid the private ones in the browser would be
 * one forgotten `.filter()` away from leaking answers nobody agreed to share.
 */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const rows = await db
      .select({
        id: reflections.id,
        requestId: reflections.requestId,
        didDifferently: reflections.didDifferently,
        counterfactual: reflections.counterfactual,
        createdAt: reflections.createdAt,
        updatedAt: reflections.updatedAt,
        seekerClerkId: reflections.seekerClerkId,
        // Two sources for the seeker's real name, in preference order below.
        profileFirstName: seekers.firstName,
        profileLastName: seekers.lastName,
        requestSeekerName: requests.seekerName,
        seekerEmail: requests.seekerEmail,
        mentorFirstName: mentors.firstName,
        mentorLastName: mentors.lastName,
        mentorCompany: mentors.company,
      })
      .from(reflections)
      .leftJoin(mentors, eq(reflections.mentorId, mentors.id))
      // Both joins are LEFT. A seeker who signed in but never finished
      // onboarding has no `seekers` row, and the request is what carries the
      // name they gave in that case — dropping the reflection over a missing
      // profile would lose the answer entirely.
      .leftJoin(seekers, eq(seekers.clerkId, reflections.seekerClerkId))
      .leftJoin(requests, eq(reflections.requestId, requests.id))
      .where(eq(reflections.shareable, true))
      .orderBy(desc(reflections.createdAt))
      .limit(500);

    const result = rows.map(({ profileFirstName, profileLastName, requestSeekerName, ...r }) => {
      // Profile name wins over the one typed into the request, which may be a
      // first name or a nickname. Falls back to the request, then to the Clerk
      // id, so a row is never listed as nobody.
      const fromProfile = [profileFirstName, profileLastName].filter(Boolean).join(' ');
      return {
        ...r,
        seekerName: fromProfile || requestSeekerName || r.seekerClerkId,
        mentorName: r.mentorFirstName
          ? `${r.mentorFirstName} ${r.mentorLastName}`
          : 'unknown mentor',
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'GET /api/admin/reflections');
  }
}
