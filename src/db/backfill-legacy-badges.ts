import { db } from '@/db';
import { mentors, mentorBadges } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { BADGE_META, deservedBadges, type BadgeType } from '@/lib/badge-meta';
import { translateLegacyBadges, legacyLabel, LEGACY_BADGE_MAP } from '@/lib/badge-legacy';

/**
 * One-time migration of `mentors.badges` — the legacy CSV column — into the
 * badges table, so the table is the single source of truth.
 *
 *   npm run db:backfill-legacy-badges            # dry run, writes nothing
 *   npm run db:backfill-legacy-badges -- --apply # actually inserts
 *
 * Dry run is the default deliberately. This reads a column that has been written
 * by a cron for months without anything validating it, so the plan is worth
 * looking at before it becomes rows.
 *
 * THE RULE: a legacy badge is carried over only where the mentor's own sipCount
 * still earns it. Where the two disagree, sipCount wins and the legacy slug is
 * dropped, with the mentor named in the report.
 *
 * That decision matters more than it looks. The alternative — trusting the CSV —
 * would put badges in the table that `checkAndAwardBadges` would never produce,
 * so the awarding rule and the stored data would disagree permanently and
 * nothing downstream could tell which was right. Trusting sipCount keeps the
 * table derivable from the mentor's record, which is the property that makes the
 * new system a source of truth rather than a second opinion.
 *
 * Idempotent: inserts go through the unique index on (mentor_id, badge_type), so
 * a second run inserts nothing. Awards are marked seen, since these are badges
 * the mentor has effectively held for months and should not produce a stack of
 * celebration modals on their next dashboard visit.
 */

const apply = process.argv.includes('--apply');

type Carried = { name: string; badge: BadgeType };
type Dropped = { name: string; mentorId: string; slug: string; sipCount: number; reason: string };

async function backfill() {
  const rows = await db
    .select({
      id: mentors.id,
      firstName: mentors.firstName,
      lastName: mentors.lastName,
      sipCount: mentors.sipCount,
      createdAt: mentors.createdAt,
      legacy: mentors.badges,
    })
    .from(mentors)
    .orderBy(asc(mentors.createdAt));

  console.log(apply
    ? `APPLY: migrating legacy badges for ${rows.length} mentors`
    : `DRY RUN: no writes. ${rows.length} mentors inspected. Re-run with -- --apply to insert.`);

  const carried: Carried[] = [];
  const dropped: Dropped[] = [];
  const unknownSlugs = new Map<string, number>();
  let mentorsWithLegacy = 0;

  for (const mentor of rows) {
    const { slugs, unknown } = translateLegacyBadges(mentor.legacy);
    for (const slug of unknown) unknownSlugs.set(slug, (unknownSlugs.get(slug) ?? 0) + 1);
    if (slugs.length === 0) continue;
    mentorsWithLegacy++;

    const name = `${mentor.firstName} ${mentor.lastName}`;
    // What the canonical rule says this mentor holds, from their own record.
    const deserved = new Set(deservedBadges(mentor));

    const toInsert: BadgeType[] = [];
    for (const slug of slugs) {
      const type = LEGACY_BADGE_MAP[slug];
      if (!type) continue; // already counted in `unknown`
      if (deserved.has(type)) {
        if (!toInsert.includes(type)) toInsert.push(type);
        carried.push({ name, badge: type });
      } else {
        dropped.push({
          name,
          mentorId: mentor.id,
          slug,
          sipCount: mentor.sipCount,
          reason: `sip_count ${mentor.sipCount} does not earn ${BADGE_META[type].label} (${BADGE_META[type].criteria})`,
        });
      }
    }

    if (toInsert.length === 0) continue;

    console.log(`  ${name}: ${slugs.map(legacyLabel).join(', ')} -> ${toInsert.map(t => BADGE_META[t].label).join(', ')}`);

    if (apply) {
      await db
        .insert(mentorBadges)
        .values(toInsert.map(badgeType => ({ mentorId: mentor.id, badgeType, seenAt: new Date() })))
        .onConflictDoNothing({ target: [mentorBadges.mentorId, mentorBadges.badgeType] });
    }
  }

  console.log('\n---');
  console.log(`mentors holding legacy badges: ${mentorsWithLegacy}`);
  console.log(`legacy badges carried over:    ${carried.length}`);
  console.log(`legacy badges dropped:         ${dropped.length}`);

  if (dropped.length > 0) {
    console.log('\nDROPPED — the CSV claimed these, the mentor\'s sip_count does not support them:');
    for (const d of dropped) {
      console.log(`  ${d.name} (${d.mentorId})`);
      console.log(`    slug "${d.slug}" -> ${d.reason}`);
    }
  }

  if (unknownSlugs.size > 0) {
    console.log('\nUNKNOWN SLUGS — not in the mapping table, migrated nowhere:');
    for (const [slug, count] of unknownSlugs) console.log(`  "${slug}" on ${count} mentor(s)`);
    console.log('  Investigate before removing the legacy column.');
  }

  if (!apply) console.log('\nNothing was written. Re-run with -- --apply once the plan above looks right.');
}

backfill()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Legacy badge backfill failed:', err);
    process.exit(1);
  });
