import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { quizSuggestLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { parseInterest, type InterestTag } from '@/lib/interests';

/**
 * One random mentor for the landing-page quiz's reveal step.
 *
 * Public and unauthenticated by design — the whole point of the quiz is that it
 * runs before anyone has an account. That makes the response shape the security
 * boundary: the mentor object is a hand-written allowlist of four fields rather
 * than `publicMentor()`, because this is the one mentor-shaped payload a
 * completely anonymous caller can pull, and it should stay narrower than what
 * the signed-out directory already shows.
 *
 * Two response shapes, discriminated on `matched`:
 *
 *   { matched: true,  mentor: { mentorId, name, shortBio, avatarData } }
 *   { matched: false, suggestion: { interest, openMentors } | null }
 *
 * The discriminator is the one field beyond the four. A bare mentor object with
 * no flag would leave the client inferring "no match" from a missing key, and
 * the zero-match branch has to carry a payload of its own anyway: the quiz
 * offers the visitor a category that does have people in it rather than
 * dead-ending, so the endpoint is what knows which category that is.
 */

/** Long enough to be worth reading on the reveal card, short enough to fit it. */
const SHORT_BIO_CHARS = 180;

function shortBio(bio: string): string {
  const flat = bio.replace(/\s+/g, ' ').trim();
  if (flat.length <= SHORT_BIO_CHARS) return flat;
  // Cut on a word boundary; a bio sliced mid-word reads as a rendering bug.
  const cut = flat.slice(0, SHORT_BIO_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Open, not banned, not self-deleted. The same visibility rule the directory uses. */
const VISIBLE = sql`is_open = true AND banned = false AND deleted_at IS NULL`;

/**
 * A random tag that currently has at least one open mentor, excluding the one
 * the visitor already asked for.
 *
 * Random, not busiest. Ranking by open-mentor count sounds like the helpful
 * choice and is not: one category is almost always the biggest, so every
 * visitor whose pick came up empty was offered the same word. On the live
 * directory that meant "tech" every single time, for all ten of the twenty
 * tags that currently have nobody open. Randomising spreads those visitors
 * across every category that actually has someone in it.
 *
 * `ORDER BY random()` covers every row and the loop takes the first one the
 * vocabulary recognises, skipping the rest without reordering, so the result
 * stays uniform across the recognised tags rather than favouring whichever the
 * database happened to return first.
 *
 * Only tags in INTEREST_TAGS can be suggested. `mentors.topics` is free text
 * that a mentor types, so it holds values the quiz has no chip for, and
 * offering one back would produce a button that cannot be answered.
 */
async function suggestAlternate(exclude: InterestTag) {
  const rows = await db.execute(sql`
    SELECT btrim(topic) AS tag, count(*)::int AS n
    FROM mentors, unnest(string_to_array(lower(topics), ',')) AS topic
    WHERE ${VISIBLE} AND btrim(topic) <> ${exclude.toLowerCase()}
    GROUP BY 1
    ORDER BY random()
  `);

  for (const row of rows.rows as { tag: string; n: number }[]) {
    const known = parseInterest(row.tag);
    // parseInterest returns the canonical casing from INTEREST_TAGS ('AI/ML',
    // not 'ai/ml'), which is what the quiz needs to re-query and to render.
    if (known && known !== exclude) return { interest: known, openMentors: row.n };
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { success, reset } = await quizSuggestLimiter.limit(limitKey(req));
    if (!success) return tooManyRequests(reset);

    const url = new URL(req.url);
    // Allowlisted rather than sanitised: the value is compared against the
    // topics column, and an unknown tag can only ever match nothing, so
    // refusing it outright is both safer and a more honest 400.
    const interest = parseInterest(url.searchParams.get('interest'));
    if (!interest) return NextResponse.json({ error: 'Unknown interest' }, { status: 400 });

    /**
     * Pick from the least-loaded half of the category, at random.
     *
     * Purely random across the category sends the busiest mentors more
     * requests than they can answer while quieter ones never surface, and a
     * mentor sitting on unanswered requests is the failure mode this feature
     * can most easily cause.
     *
     * "Load" is the definition the codebase already uses for a mentor's
     * outstanding work, taken from the duplicate-request guard in
     * POST /api/request: a request is open while it is `pending`, or while it
     * is `accepted` but not yet counted as a completed sip (`sip_counted_at IS
     * NULL`). Counting only `pending` would call a mentor idle the moment they
     * accept, which is the point at which the sip has still to happen.
     *
     * The pool is the bottom half rather than strictly the minimum, so one
     * mentor a single request ahead of the pack does not absorb everything.
     * `GREATEST(1, ...)` is what makes the pool non-empty by construction: for
     * one candidate it is 1, and it can never be 0 while the category has
     * anyone open. There is no threshold anywhere here, so no load level can
     * exclude every mentor and produce a false "nobody is open".
     *
     * `ORDER BY load, random()` rather than `ORDER BY load` alone: ties are the
     * common case on a young directory, and without the random tiebreak
     * Postgres returns them in a stable order, so the same half of an evenly
     * loaded category would win every time. With it, an all-equal category
     * degrades to a uniform random pick across everyone in it.
     *
     * mentors.topics is a comma-separated string ('tech, AI/ML'), so an exact
     * tag match means splitting and trimming rather than a LIKE — 'design'
     * must not match 'instructional design', and 'co-op' must not match a
     * substring of some other tag. Same shape as notifyMatchingSeekers in
     * POST /api/mentor, which compares the seeker side of the same vocabulary.
     */
    const rows = await db.execute(sql`
      WITH pool AS (
        SELECT
          m.id, m.first_name, m.last_name, m.bio, m.avatar_data,
          (
            SELECT count(*) FROM requests r
            WHERE r.mentor_id = m.id
              AND (r.status = 'pending' OR (r.status = 'accepted' AND r.sip_counted_at IS NULL))
          ) AS load
        FROM mentors m
        WHERE ${VISIBLE}
          AND EXISTS (
            SELECT 1 FROM unnest(string_to_array(lower(m.topics), ',')) AS topic
            WHERE btrim(topic) = ${interest.toLowerCase()}
          )
      ),
      ranked AS (
        SELECT *,
          count(*) OVER () AS total,
          row_number() OVER (ORDER BY load ASC, random()) AS rn
        FROM pool
      )
      SELECT id, first_name, last_name, bio, avatar_data
      FROM ranked
      WHERE rn <= GREATEST(1, (total + 1) / 2)
      ORDER BY random()
      LIMIT 1
    `);

    const mentor = rows.rows[0] as
      | { id: string; first_name: string; last_name: string; bio: string; avatar_data: string | null }
      | undefined;

    // No silent substitution. Showing an off-topic mentor as though they were
    // the match would be a worse answer than saying so: the quiz has a step for
    // this, and it asks rather than assumes.
    if (!mentor) {
      return NextResponse.json({ matched: false, suggestion: await suggestAlternate(interest) });
    }

    return NextResponse.json({
      matched: true,
      mentor: {
        mentorId: mentor.id,
        name: `${mentor.first_name} ${mentor.last_name}`.trim(),
        shortBio: shortBio(mentor.bio ?? ''),
        // Mentors have no photo — the platform uses a 16x16 pixel avatar stored
        // as an encoded string and rendered client-side by <PixelAvatar>. Named
        // for what it is rather than as `photoUrl`, which would be a URL that
        // is not one.
        avatarData: mentor.avatar_data,
      },
    });
  } catch (err) {
    return handleApiError(err, 'GET /api/mentors/suggest');
  }
}
