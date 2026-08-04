/**
 * Badge vocabulary and presentation. No database imports, deliberately: the
 * dashboard modal, the profile pills and the certificate renderer are all client
 * or edge surfaces, and pulling `@/db` in for a label would drag the ORM along
 * with it. The server-side award and lookup functions live in `@/lib/badges`.
 */

/**
 * The canonical list, and the single source of truth for the Postgres enum —
 * `badgeTypeEnum` in the schema is built from this array, so the database and
 * the app cannot drift apart on what a badge type is.
 */
export const BADGE_TYPES = [
  'founding_mentor',
  'first_sip',
  'five_sips',
  'ten_sips',
  'super_mentor',
] as const;

export type BadgeType = (typeof BADGE_TYPES)[number];

export function isBadgeType(v: unknown): v is BadgeType {
  return typeof v === 'string' && (BADGE_TYPES as readonly string[]).includes(v);
}

/**
 * Everything user-facing about a badge, in one place, because four surfaces
 * render the same badge and must not disagree: the pill on a public profile, the
 * rail in the dashboard, the celebration modal, and the certificate image.
 *
 * `prestige` is the display order, highest first. Sip count drives most of it,
 * with founding_mentor sitting near the top because it is the one badge that can
 * never be earned again — it closed the day the cutoff below passed.
 */
export const BADGE_META: Record<BadgeType, {
  label: string;
  /** Printed on the certificate under the badge name. */
  blurb: string;
  /** How it was earned. Shown on the pill's tooltip and the certificate. */
  criteria: string;
  color: string;
  prestige: number;
}> = {
  super_mentor: {
    label: 'Super Mentor',
    blurb: 'Twenty sips poured. A habit, not a favour.',
    criteria: '20 completed sips',
    color: '#52bdc2',
    prestige: 50,
  },
  founding_mentor: {
    label: 'Founding Mentor',
    blurb: 'Here before the first pour.',
    criteria: 'Joined Sip in its founding season',
    color: '#81b3c8',
    prestige: 40,
  },
  ten_sips: {
    label: 'Ten Sips',
    blurb: 'Ten conversations that changed someone’s week.',
    criteria: '10 completed sips',
    color: '#0891B2',
    prestige: 30,
  },
  five_sips: {
    label: 'Five Sips',
    blurb: 'Five people got the answer they were stuck on.',
    criteria: '5 completed sips',
    color: '#4E8FA8',
    prestige: 20,
  },
  first_sip: {
    label: 'First Sip',
    blurb: 'The first one. Always the hardest to say yes to.',
    criteria: '1 completed sip',
    color: '#D97706',
    prestige: 10,
  },
};

/** Sip-count thresholds, ascending. Everything at or below the count is earned. */
export const SIP_MILESTONES: [number, BadgeType][] = [
  [1, 'first_sip'],
  [5, 'five_sips'],
  [10, 'ten_sips'],
  [20, 'super_mentor'],
];

/**
 * Mentors who existed before this instant are Founding Mentors.
 *
 * A fixed constant rather than "now" at execution time, so the backfill script,
 * the award check and any future re-run all agree on who qualifies. Moving it
 * later would hand the badge to people who joined after the cutoff, which is
 * exactly what it must not do.
 */
export const FOUNDING_MENTOR_CUTOFF = new Date('2026-08-04T00:00:00.000Z');

/** Prestige order, highest first. The order every surface renders badges in. */
export function byPrestige<T extends { badgeType: BadgeType }>(list: T[]): T[] {
  return [...list].sort((a, b) => BADGE_META[b.badgeType].prestige - BADGE_META[a.badgeType].prestige);
}

/**
 * Which badges a mentor's record says they should hold right now.
 *
 * Pure, so the rules can be reasoned about without a database: the caller
 * supplies the row and gets the full set back, already-earned included. Awarding
 * is then just "insert these and ignore the ones already there".
 */
export function deservedBadges(mentor: { sipCount: number; createdAt: Date }): BadgeType[] {
  const earned: BadgeType[] = [];
  if (mentor.createdAt < FOUNDING_MENTOR_CUTOFF) earned.push('founding_mentor');
  for (const [threshold, type] of SIP_MILESTONES) {
    if (mentor.sipCount >= threshold) earned.push(type);
  }
  return earned;
}

/** Public page for a badge certificate. The URL that gets shared. */
export function certificatePath(mentorId: string, badgeType: BadgeType): string {
  return `/certificates/${mentorId}/${badgeType}`;
}

/** The PNG itself. `download` flips it to an attachment. */
export function certificateImagePath(mentorId: string, badgeType: BadgeType, download = false): string {
  return `/api/certificate/${mentorId}/${badgeType}${download ? '?download=1' : ''}`;
}

export function badgeShareText(badgeType: BadgeType): string {
  return `Just became a ${BADGE_META[badgeType].label} on Sip! \u{1FAD6} getsip.co`;
}

/**
 * LinkedIn's share intent.
 *
 * `shareArticle` is the form that still accepts prefilled text alongside the
 * URL. LinkedIn decides for itself how much of `summary` to show — the title and
 * the link preview do the work — so the same text is also offered as a copy
 * button next to the button that opens this.
 */
export function linkedInShareUrl(shareUrl: string, text: string): string {
  const params = new URLSearchParams({
    mini: 'true',
    url: shareUrl,
    title: text,
    summary: text,
    source: 'Sip',
  });
  return `https://www.linkedin.com/shareArticle?${params.toString()}`;
}
