import { db } from '@/db';
import { mentors } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { checkAndAwardBadges, BADGE_META, FOUNDING_MENTOR_CUTOFF, type BadgeType } from '@/lib/badges';

/**
 * One-time backfill of the badges table for mentors who existed before it did.
 *
 * Run once after the migration:
 *   npm run db:backfill-badges
 *
 * Two things get filled in. Founding Mentor goes to everyone who signed up
 * before FOUNDING_MENTOR_CUTOFF, and the sip-count badges go to anyone whose
 * existing sipCount already clears a threshold — without that second part a
 * mentor with fifteen sips would show an empty badge row on their profile until
 * their next completed sip happened to trigger the awarding path.
 *
 * Safe to run more than once. Awarding is idempotent through the unique index on
 * (mentor_id, badge_type), so a second run inserts nothing and reports zero new.
 *
 * Everything awarded here is marked as already seen. These are badges the
 * mentors have effectively held for months; greeting someone with four stacked
 * celebration modals on their next dashboard visit would be noise, not news.
 */
async function backfill() {
  const rows = await db
    .select({ id: mentors.id, firstName: mentors.firstName, lastName: mentors.lastName, createdAt: mentors.createdAt })
    .from(mentors)
    .orderBy(asc(mentors.createdAt));

  console.log(`Backfilling badges for ${rows.length} mentors (founding cutoff ${FOUNDING_MENTOR_CUTOFF.toISOString()})`);

  const tally: Partial<Record<BadgeType, number>> = {};
  let mentorsTouched = 0;

  for (const mentor of rows) {
    // Sequential on purpose: this runs against a serverless Postgres over HTTP,
    // and a one-off script has no reason to open hundreds of parallel writes at
    // a database that live traffic is also using.
    const awarded = await checkAndAwardBadges(mentor.id, { markSeen: true });
    if (awarded.length === 0) continue;

    mentorsTouched++;
    for (const type of awarded) tally[type] = (tally[type] ?? 0) + 1;
    console.log(`  ${mentor.firstName} ${mentor.lastName}: ${awarded.map(t => BADGE_META[t].label).join(', ')}`);
  }

  console.log('\nDone.');
  console.log(`  mentors given at least one badge: ${mentorsTouched}`);
  for (const [type, count] of Object.entries(tally)) {
    console.log(`  ${BADGE_META[type as BadgeType].label}: ${count}`);
  }
  if (mentorsTouched === 0) console.log('  nothing to do — every mentor already holds what they have earned');
}

backfill()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
