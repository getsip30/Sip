import { db } from '@/db';
import { mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/validate';
import { findBadge, isBadgeType } from '@/lib/badges';
import { renderCertificate } from '@/lib/certificate';
import { publicReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';

/**
 * The certificate PNG for one mentor's badge.
 *
 * Public on purpose — LinkedIn has to be able to fetch it to build a preview,
 * and the mentor has to be able to hand the link to anyone. What it is not is
 * forgeable: both ids come from the URL, so the badge is looked up before
 * anything is drawn, and a mentor who has not earned it gets a 404 rather than a
 * picture claiming they did.
 *
 * Only the mentor's name and job title are drawn. Nothing here reads an email,
 * a booking link, or any other field a public profile would not already show.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ mentorId: string; badgeType: string }> }
) {
  try {
    const { mentorId, badgeType } = await params;

    // Image generation is markedly more expensive than a JSON read, and this
    // route is unauthenticated, so it is limited before any work happens.
    const { success, reset } = await publicReadLimiter.limit(limitKey(req));
    if (!success) return tooManyRequests(reset);

    if (!isUuid(mentorId) || !isBadgeType(badgeType)) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    const rows = await db
      .select({
        firstName: mentors.firstName,
        lastName: mentors.lastName,
        role: mentors.role,
        company: mentors.company,
        banned: mentors.banned,
        deletedAt: mentors.deletedAt,
      })
      .from(mentors)
      .where(eq(mentors.id, mentorId))
      .limit(1);

    const mentor = rows[0];
    if (!mentor || mentor.banned || mentor.deletedAt) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    const badge = await findBadge(mentorId, badgeType);
    if (!badge) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });

    const url = new URL(req.url);
    const download = url.searchParams.get('download') === '1';

    const headers: Record<string, string> = {
      // A certificate never changes once awarded, so it is cheap to cache hard
      // at the edge. Revalidating hourly still lets a name change work through.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    };
    // The filename is built from the badge slug, never from the mentor's name:
    // that string is user-supplied and would be going into a response header.
    if (download) {
      headers['Content-Disposition'] = `attachment; filename="sip-${badgeType}-certificate.png"`;
    }

    return renderCertificate(
      {
        badgeType,
        mentorName: `${mentor.firstName} ${mentor.lastName}`.trim(),
        mentorTitle: mentor.role && mentor.company ? `${mentor.role} @ ${mentor.company}` : null,
        awardedAt: badge.awardedAt,
      },
      { headers }
    );
  } catch (err) {
    return handleApiError(err, 'GET /api/certificate/[mentorId]/[badgeType]');
  }
}
