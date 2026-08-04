import { db } from '@/db';
import { mentorBadges, mentors, badgeTypeEnum } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { logSwallowed } from '@/lib/logger';
import { BADGE_TYPES, byPrestige, deservedBadges, type BadgeType } from '@/lib/badge-meta';

/**
 * Server-side awarding and lookup. Everything presentational — labels, colours,
 * ordering, the milestone table — lives in `@/lib/badge-meta`, which is safe to
 * import from a client component. Re-exported here so server callers only need
 * one import.
 */
export * from '@/lib/badge-meta';

/**
 * Drift guard. The badge list is spelled out twice — once as a Postgres enum in
 * the schema, once as presentation metadata — because drizzle-kit compiles the
 * schema without the '@/' path alias and so cannot import the other. These two
 * assignments only typecheck while the unions are mutually assignable, so adding
 * a badge to one list and not the other fails `npm run typecheck` rather than
 * failing at runtime on an insert.
 */
const _enumCoversMeta: readonly (typeof badgeTypeEnum.enumValues)[number][] = BADGE_TYPES;
const _metaCoversEnum: readonly BadgeType[] = badgeTypeEnum.enumValues;
void _enumCoversMeta;
void _metaCoversEnum;

export type EarnedBadge = {
  badgeType: BadgeType;
  awardedAt: Date;
};

/**
 * Award everything this mentor has qualified for and return only what was new.
 *
 * Runs after a sip is marked completed. Duplicates are prevented by the unique
 * index rather than by a read-then-write, so two overlapping cron runs cannot
 * both decide a badge is missing and insert it twice — the loser's insert
 * conflicts and returns no row, which is also how the caller learns there is
 * nothing new to celebrate.
 *
 * @param markSeen Suppresses the dashboard modal for these awards. Used by the
 *   backfill, where a mentor with a long history would otherwise be met by a
 *   stack of modals for badges they have effectively held all along.
 */
export async function checkAndAwardBadges(
  mentorId: string,
  { markSeen = false }: { markSeen?: boolean } = {}
): Promise<BadgeType[]> {
  const rows = await db
    .select({ sipCount: mentors.sipCount, createdAt: mentors.createdAt })
    .from(mentors)
    .where(eq(mentors.id, mentorId))
    .limit(1);

  const mentor = rows[0];
  if (!mentor) return [];

  const deserved = deservedBadges(mentor);
  if (deserved.length === 0) return [];

  const inserted = await db
    .insert(mentorBadges)
    .values(deserved.map(badgeType => ({
      mentorId,
      badgeType,
      seenAt: markSeen ? new Date() : null,
    })))
    .onConflictDoNothing({ target: [mentorBadges.mentorId, mentorBadges.badgeType] })
    .returning({ badgeType: mentorBadges.badgeType });

  return inserted.map(r => r.badgeType);
}

/**
 * Never lets a badge failure take down the sip completion that triggered it. A
 * missed badge is recoverable — the next completed sip re-checks the whole set,
 * and the backfill can be re-run — whereas a thrown error here would abort the
 * cron mid-run and leave later mentors' sips uncounted.
 */
export async function awardBadgesQuietly(mentorId: string): Promise<BadgeType[]> {
  try {
    return await checkAndAwardBadges(mentorId);
  } catch (err) {
    logSwallowed('badges.award_failed', err, { mentorId });
    return [];
  }
}

/** One mentor's badges, prestige order. */
export async function badgesForMentor(mentorId: string): Promise<EarnedBadge[]> {
  const rows = await db
    .select({ badgeType: mentorBadges.badgeType, awardedAt: mentorBadges.awardedAt })
    .from(mentorBadges)
    .where(eq(mentorBadges.mentorId, mentorId));
  return byPrestige(rows);
}

/**
 * Badges for many mentors at once, keyed by mentor id.
 *
 * The admin overview lists up to a thousand mentors; asking per mentor would be
 * a thousand round trips against a serverless database to fill in one column.
 */
export async function badgesForMentors(mentorIds: string[]): Promise<Record<string, EarnedBadge[]>> {
  if (mentorIds.length === 0) return {};
  const rows = await db
    .select({
      mentorId: mentorBadges.mentorId,
      badgeType: mentorBadges.badgeType,
      awardedAt: mentorBadges.awardedAt,
    })
    .from(mentorBadges)
    .where(inArray(mentorBadges.mentorId, mentorIds));

  const grouped: Record<string, EarnedBadge[]> = {};
  for (const row of rows) {
    (grouped[row.mentorId] ??= []).push({ badgeType: row.badgeType, awardedAt: row.awardedAt });
  }
  for (const id of Object.keys(grouped)) grouped[id] = byPrestige(grouped[id]);
  return grouped;
}

/**
 * Does this mentor actually hold this badge?
 *
 * The certificate route is public and takes both ids from the URL, so this is
 * the check that stops anyone from minting a Super Mentor certificate for a
 * mentor who has given one sip.
 */
export async function findBadge(mentorId: string, badgeType: BadgeType): Promise<EarnedBadge | null> {
  const rows = await db
    .select({ badgeType: mentorBadges.badgeType, awardedAt: mentorBadges.awardedAt })
    .from(mentorBadges)
    .where(and(eq(mentorBadges.mentorId, mentorId), eq(mentorBadges.badgeType, badgeType)))
    .limit(1);
  return rows[0] ?? null;
}
