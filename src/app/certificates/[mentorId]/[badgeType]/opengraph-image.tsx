import { db } from '@/db';
import { mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isUuid } from '@/lib/validate';
import { findBadge, isBadgeType } from '@/lib/badges';
import { renderCertificate, CERTIFICATE_SIZE } from '@/lib/certificate';

/**
 * The certificate again, this time as the page's Open Graph image.
 *
 * It duplicates the /api/certificate route on purpose. robots.txt disallows
 * /api/, and LinkedIn's crawler honours that — pointing og:image into /api would
 * mean the share a mentor posts renders without its picture, which is the entire
 * value of sharing it. Next's file convention puts the same PNG on a crawlable
 * URL under the page it belongs to, and wires up og:image and twitter:image for
 * free. The /api route stays for the in-app preview and the download link.
 *
 * Both go through renderCertificate, so the two can never drift.
 */

export const alt = 'Sip badge certificate';
export const size = CERTIFICATE_SIZE;
export const contentType = 'image/png';

type Props = { params: Promise<{ mentorId: string; badgeType: string }> };

export default async function CertificateOgImage({ params }: Props) {
  const { mentorId, badgeType } = await params;

  if (!isUuid(mentorId) || !isBadgeType(badgeType)) {
    return new Response('Not found', { status: 404 });
  }

  const rows = await db
    .select({
      firstName: mentors.firstName,
      lastName: mentors.lastName,
      role: mentors.role,
      company: mentors.company,
      banned: mentors.banned,
    })
    .from(mentors)
    .where(eq(mentors.id, mentorId))
    .limit(1);

  const mentor = rows[0];
  if (!mentor || mentor.banned) return new Response('Not found', { status: 404 });

  const badge = await findBadge(mentorId, badgeType);
  if (!badge) return new Response('Not found', { status: 404 });

  return renderCertificate({
    badgeType,
    mentorName: `${mentor.firstName} ${mentor.lastName}`.trim(),
    mentorTitle: mentor.role && mentor.company ? `${mentor.role} @ ${mentor.company}` : null,
    awardedAt: badge.awardedAt,
  });
}
