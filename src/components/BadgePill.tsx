'use client';
import Link from 'next/link';
import { BADGE_META, certificatePath, type BadgeType } from '@/lib/badge-meta';

/**
 * One earned badge, as a small pill.
 *
 * Shared by the public profile and the mentor's own dashboard so a badge looks
 * the same wherever it appears. The dot takes the badge's colour and the rest
 * stays on the app's surface/border tokens — five saturated pills in a row read
 * as a toolbar rather than as achievements.
 *
 * `href` turns it into a link to the certificate. Given on a mentor's own
 * dashboard, where the certificate is theirs to share; omitted on the public
 * profile, where the pill is just a fact about them.
 */
export default function BadgePill({
  badgeType,
  href,
  size = 'md',
}: {
  badgeType: BadgeType;
  href?: string;
  size?: 'sm' | 'md';
}) {
  const meta = BADGE_META[badgeType];
  if (!meta) return null;

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: size === 'sm' ? 6 : 8,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: size === 'sm' ? '4px 12px' : '6px 14px',
    fontSize: size === 'sm' ? 12 : 13,
    color: 'var(--text)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  };

  const inner = (
    <>
      <span
        aria-hidden="true"
        style={{
          width: size === 'sm' ? 7 : 8,
          height: size === 'sm' ? 7 : 8,
          borderRadius: '50%',
          background: meta.color,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {meta.label}
    </>
  );

  if (href) {
    return <Link href={href} title={meta.criteria} style={style}>{inner}</Link>;
  }
  return <span title={meta.criteria} style={style}>{inner}</span>;
}

/** Convenience wrapper for a mentor's own badge, linked to its certificate. */
export function OwnBadgePill({ mentorId, badgeType }: { mentorId: string; badgeType: BadgeType }) {
  return <BadgePill badgeType={badgeType} href={certificatePath(mentorId, badgeType)} />;
}
