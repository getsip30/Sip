import { BADGE_META, type BadgeType } from '@/lib/badge-meta';

/**
 * DEPRECATED. The translation layer between `mentors.badges` — the legacy CSV
 * column — and the badges table that replaced it.
 *
 * This module exists to be deleted. It is the only place that still knows what
 * the old slugs meant, and once the column itself goes (see the deprecation note
 * on `mentors.badges` in the schema), this file goes with it. Nothing outside
 * the one-time backfill and the comparison script should import it.
 */

/**
 * Old slug to new badge type.
 *
 * Three of the five are exact: the thresholds match, so the mapping is nothing
 * more than a rename.
 *
 * `legend` (25 sips) and `goat` (50) have no counterpart — the new ladder tops
 * out at `super_mentor` on 20 — and both collapse into it. That is a deliberate
 * product decision to lose two prestige tiers, not an accident of the mapping.
 * It cannot over-grant: anyone who held either slug necessarily had 25 or more
 * sips, which already clears 20. It was taken while no mentor in the database
 * held either badge, so it rewrote nothing.
 */
export const LEGACY_BADGE_MAP: Record<string, BadgeType> = {
  'first-sip': 'first_sip',
  'regular': 'five_sips',
  'veteran': 'ten_sips',
  'legend': 'super_mentor',
  'goat': 'super_mentor',
};

/** The thresholds the legacy cron awarded on. Kept for the comparison report. */
export const LEGACY_THRESHOLDS: Record<string, number> = {
  'first-sip': 1,
  'regular': 5,
  'veteran': 10,
  'legend': 25,
  'goat': 50,
};

/** Display labels as the leaderboard rendered them, for before/after diffing. */
export const LEGACY_LABELS: Record<string, string> = {
  'first-sip': 'First Sip',
  'regular': 'Regular',
  'veteran': 'Veteran',
  'legend': 'Legend',
  'goat': 'GOAT',
};

export type LegacyTranslation = {
  /** Slugs found in the column, in the order they were stored. */
  slugs: string[];
  /** Distinct new badge types those slugs translate to. */
  mapped: BadgeType[];
  /** Slugs with no entry in the map at all. Should never happen; reported if it does. */
  unknown: string[];
};

/** Split the CSV and translate it. Tolerates whitespace, blanks and duplicates. */
export function translateLegacyBadges(csv: string | null | undefined): LegacyTranslation {
  const slugs = (csv ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const mapped: BadgeType[] = [];
  const unknown: string[] = [];

  for (const slug of slugs) {
    const type = LEGACY_BADGE_MAP[slug];
    if (!type) {
      if (!unknown.includes(slug)) unknown.push(slug);
      continue;
    }
    // legend and goat both land on super_mentor, so dedupe.
    if (!mapped.includes(type)) mapped.push(type);
  }

  return { slugs, mapped, unknown };
}

/** Label for a legacy slug, falling back to the new badge's label. */
export function legacyLabel(slug: string): string {
  const mapped = LEGACY_BADGE_MAP[slug];
  return LEGACY_LABELS[slug] ?? (mapped ? BADGE_META[mapped].label : slug);
}
