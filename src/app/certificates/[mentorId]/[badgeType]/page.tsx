import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isUuid } from '@/lib/validate';
import { findBadge } from '@/lib/badges';
import {
  BADGE_META,
  badgeShareText,
  certificateImagePath,
  certificatePath,
  isBadgeType,
  linkedInShareUrl,
} from '@/lib/badge-meta';
import { absoluteUrl, canonical } from '@/lib/site';
import { BG, SURFACE, BORDER, TEXT, MUTED } from '@/lib/theme';

/**
 * The public home of a badge certificate.
 *
 * This page exists so there is something to share. LinkedIn shares a URL, not a
 * file, and it builds its preview by fetching that URL's Open Graph image — so
 * the thing a mentor posts has to be a page whose og:image is the certificate,
 * not the PNG itself. It doubles as where the download button lives.
 *
 * Server-rendered and cached: the content is fixed once the badge is awarded.
 */

export const revalidate = 3600;

type Props = { params: Promise<{ mentorId: string; badgeType: string }> };

async function getCertificate(mentorId: string, badgeType: string) {
  if (!isUuid(mentorId) || !isBadgeType(badgeType)) return null;

  const rows = await db
    .select({
      id: mentors.id,
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
  // Same rule as the profile page: a banned mentor's pages are not served, so a
  // certificate cannot outlive the profile it belongs to.
  if (!mentor || mentor.banned) return null;

  const badge = await findBadge(mentorId, badgeType);
  if (!badge) return null;

  return { mentor, badge, badgeType };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mentorId, badgeType } = await params;
  const data = await getCertificate(mentorId, badgeType);

  if (!data) {
    return { title: 'Certificate not found', robots: { index: false, follow: false } };
  }

  const meta = BADGE_META[data.badgeType];
  const name = `${data.mentor.firstName} ${data.mentor.lastName}`;
  const title = `${name} — ${meta.label} on Sip`;
  const description = `${name} earned the ${meta.label} badge on Sip. ${meta.criteria}.`;
  const path = certificatePath(data.mentor.id, data.badgeType);

  return {
    title,
    description,
    alternates: canonical(path),
    // No `images` here on purpose. The colocated opengraph-image.tsx supplies
    // og:image and twitter:image at a crawlable, non-/api URL; naming them here
    // would override that with a path robots.txt tells LinkedIn not to fetch.
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CertificatePage({ params }: Props) {
  const { mentorId, badgeType } = await params;
  const data = await getCertificate(mentorId, badgeType);
  if (!data) notFound();

  const meta = BADGE_META[data.badgeType];
  const name = `${data.mentor.firstName} ${data.mentor.lastName}`;
  const imageSrc = certificateImagePath(data.mentor.id, data.badgeType);
  const shareText = badgeShareText(data.badgeType);
  const shareUrl = absoluteUrl(certificatePath(data.mentor.id, data.badgeType));

  const button: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 24px',
    borderRadius: 24,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT }}>
      <div className="page-shell" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <span style={{ color: MUTED, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Certificate of achievement
          </span>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.2, margin: 0 }}>
            {name} — {meta.label}
          </h1>
          <p style={{ color: MUTED, fontSize: 15, margin: 0 }}>{meta.blurb} · {meta.criteria}</p>
        </div>

        {/*
          A plain <img> rather than next/image: this is a generated PNG at a
          fixed 1200x630, served from our own route with its own cache headers,
          so there is nothing for the optimiser to add.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={`${meta.label} certificate awarded to ${name}`}
          width={1200}
          height={630}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            background: SURFACE,
            display: 'block',
          }}
        />

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
          <a
            href={certificateImagePath(data.mentor.id, data.badgeType, true)}
            style={{ ...button, background: '#52bdc2', color: '#06121A' }}
          >
            download certificate
          </a>
          <a
            href={linkedInShareUrl(shareUrl, shareText)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...button, background: '#0A66C2', color: 'white' }}
          >
            share on LinkedIn
          </a>
          <Link
            href={`/mentors/${data.mentor.id}`}
            style={{ ...button, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED }}
          >
            view profile
          </Link>
        </div>

        <p style={{ color: MUTED, fontSize: 13, marginTop: 20 }}>
          {data.mentor.role} @ {data.mentor.company} · awarded{' '}
          {data.badge.awardedAt.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
          })}
        </p>
      </div>
    </div>
  );
}
