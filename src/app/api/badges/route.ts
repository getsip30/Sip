import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { mentorBadges } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { requireMentor } from '@/lib/guards';
import { byPrestige, isBadgeType, type BadgeType } from '@/lib/badges';
import { mutationLimiter, privateReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';

/**
 * The signed-in mentor's own badges.
 *
 * Scoped to the caller rather than taking a mentor id, because the one thing
 * this returns that the public profile does not — whether a badge has been seen
 * — is nobody else's business. Public badge lists are read straight from the
 * database by the profile's server component.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success, reset } = await privateReadLimiter.limit(limitKey(req, userId));
    if (!success) return tooManyRequests(reset);

    const { mentor, error } = await requireMentor(userId);
    if (error) return error;

    const rows = await db
      .select({
        badgeType: mentorBadges.badgeType,
        awardedAt: mentorBadges.awardedAt,
        seenAt: mentorBadges.seenAt,
      })
      .from(mentorBadges)
      .where(eq(mentorBadges.mentorId, mentor.id));

    return NextResponse.json(byPrestige(rows).map(b => ({
      badgeType: b.badgeType,
      awardedAt: b.awardedAt,
      seen: b.seenAt !== null,
    })));
  } catch (err) {
    return handleApiError(err, 'GET /api/badges');
  }
}

/**
 * Marks badges as seen, so the celebration modal does not come back on the next
 * dashboard load. Idempotent, and scoped by mentor id in the WHERE — the body
 * only chooses among the caller's own rows.
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { mentor, error } = await requireMentor(userId);
    if (error) return error;

    const body = await req.json();
    const raw = body?.badgeTypes;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 10) {
      return NextResponse.json({ error: 'badgeTypes must be a non-empty array' }, { status: 400 });
    }
    const badgeTypes = raw.filter(isBadgeType) as BadgeType[];
    if (badgeTypes.length === 0) {
      return NextResponse.json({ error: 'No known badge types given' }, { status: 400 });
    }

    const updated = await db
      .update(mentorBadges)
      .set({ seenAt: new Date() })
      .where(and(
        eq(mentorBadges.mentorId, mentor.id),
        inArray(mentorBadges.badgeType, badgeTypes),
        isNull(mentorBadges.seenAt)
      ))
      .returning({ badgeType: mentorBadges.badgeType });

    return NextResponse.json({ marked: updated.map(u => u.badgeType) });
  } catch (err) {
    return handleApiError(err, 'PATCH /api/badges');
  }
}
