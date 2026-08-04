import { db } from '@/db';
import { mentors, mentorBadges } from '@/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { BADGE_META, byPrestige, deservedBadges, type BadgeType } from '@/lib/badge-meta';
import { translateLegacyBadges, legacyLabel } from '@/lib/badge-legacy';

/**
 * READ-ONLY verification for the CSV-to-table migration.
 *
 *   npm run db:compare-badges          # leaderboard rows only
 *   npm run db:compare-badges -- --all # every mentor
 *
 * Prints, per mentor, what the leaderboard USED to render (legacy CSV column,
 * the source it read before) beside what it renders NOW (badges table), and
 * marks every row where the two differ.
 *
 * A clean run is not "no differences". Two kinds of difference are expected and
 * correct:
 *
 *   + founding_mentor  — new-only, has no legacy equivalent, so every mentor
 *                        who predates the cutoff gains one badge here.
 *   - dropped          — the CSV claimed a badge the mentor's own sip_count does
 *                        not earn. Those are deliberately not carried over.
 *
 * Anything else is a real regression: a badge the mentor legitimately held that
 * the new system has lost. Those are printed under MISSING and should stop the
 * migration.
 */

const showAll = process.argv.includes('--all');

function labelsOf(types: BadgeType[]): string {
  if (types.length === 0) return '(none)';
  return byPrestige(types.map(badgeType => ({ badgeType })))
    .map(t => BADGE_META[t.badgeType].label)
    .join(', ');
}

async function compare() {
  const rows = showAll
    ? await db.select().from(mentors).where(eq(mentors.banned, false)).orderBy(desc(mentors.xp))
    : await db.select().from(mentors).where(eq(mentors.banned, false)).orderBy(desc(mentors.xp)).limit(10);

  const badgeRows = rows.length === 0 ? [] : await db
    .select({ mentorId: mentorBadges.mentorId, badgeType: mentorBadges.badgeType })
    .from(mentorBadges)
    .where(inArray(mentorBadges.mentorId, rows.map(m => m.id)));

  const byMentor = new Map<string, BadgeType[]>();
  for (const r of badgeRows) {
    const list = byMentor.get(r.mentorId) ?? [];
    list.push(r.badgeType);
    byMentor.set(r.mentorId, list);
  }

  console.log(showAll
    ? `Comparing legacy CSV vs badges table for all ${rows.length} unbanned mentors\n`
    : `Comparing legacy CSV vs badges table for the leaderboard top ${rows.length}\n`);

  const regressions: string[] = [];
  let identical = 0;
  let expectedDiff = 0;

  for (const m of rows) {
    const name = `${m.firstName} ${m.lastName}`;
    const { slugs, mapped, unknown } = translateLegacyBadges(m.badges);
    const now = byMentor.get(m.id) ?? [];

    /**
     * The completeness check is against the canonical rule, not against the CSV.
     *
     * Checking only "did every CSV badge survive" would pass a mentor whose CSV
     * is empty but whose sip_count earns three badges the table does not hold —
     * the legacy cron could simply never have run for them. The table is only a
     * source of truth if it holds everything the rule says it should, whatever
     * the old column happened to contain.
     */
    const deserved = deservedBadges(m);
    const missingFromRule = deserved.filter(t => !now.includes(t));
    const droppedFromCsv = mapped.filter(t => !now.includes(t) && !deserved.includes(t));
    const gained = now.filter(t => !mapped.includes(t));

    const same = missingFromRule.length === 0 && droppedFromCsv.length === 0 && gained.length === 0;
    if (same) identical++; else expectedDiff++;

    console.log(`${name} — sips=${m.sipCount} xp=${m.xp}`);
    console.log(`  before (CSV)   : ${slugs.length ? slugs.map(legacyLabel).join(', ') : '(none)'}`);
    console.log(`  after  (table) : ${labelsOf(now)}`);

    if (unknown.length > 0) console.log(`  ! unmapped slugs: ${unknown.join(', ')}`);

    for (const t of gained) {
      const reason = t === 'founding_mentor'
        ? 'new-only badge, no legacy equivalent'
        : 'earned by sip_count, legacy cron had not awarded it';
      console.log(`  + ${BADGE_META[t].label} — ${reason}`);
    }

    // Earned by the mentor's own record but absent from the table — the new
    // system has lost something real, whether or not the CSV ever held it.
    for (const t of missingFromRule) {
      console.log(`  ! MISSING ${BADGE_META[t].label} — sip_count ${m.sipCount} DOES earn it. REGRESSION.`);
      regressions.push(`${name} (${m.id}): ${BADGE_META[t].label}`);
    }

    // Claimed by the CSV but not supported by the rule. Dropping it is the
    // intended outcome, so it is reported but does not fail the run.
    for (const t of droppedFromCsv) {
      console.log(`  - ${BADGE_META[t].label} — dropped, sip_count ${m.sipCount} does not earn it (${BADGE_META[t].criteria})`);
    }
    console.log('');
  }

  console.log('---');
  console.log(`identical:            ${identical}`);
  console.log(`differing:            ${expectedDiff}`);
  console.log(`unexplained losses:   ${regressions.length}`);
  if (regressions.length > 0) {
    console.log('\nREGRESSIONS — a badge the mentor earns by sip_count is absent from the table:');
    for (const r of regressions) console.log(`  ${r}`);
    console.log('\nRun the backfill, or investigate, before dropping the legacy column.');
    process.exitCode = 1;
  } else {
    console.log('\nNo unexplained losses. Every difference above is either a new-only badge or a');
    console.log('deliberate drop of a badge the mentor\'s sip_count does not support.');
  }
}

compare()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(err => {
    console.error('Comparison failed:', err);
    process.exit(1);
  });
