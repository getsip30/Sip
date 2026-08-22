import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { quizSuggestLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { parseInterest } from '@/lib/quiz';

/**
 * One random mentor for the landing-page quiz's reveal step.
 *
 * Public and unauthenticated by design — the whole point of the quiz is that it
 * runs before anyone has an account. That makes the response shape the security
 * boundary: it is a hand-written allowlist of four fields rather than
 * `publicMentor()`, because this is the one mentor-shaped payload a completely
 * anonymous caller can pull, and it should stay narrower than what the
 * signed-out directory already shows.
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

export async function GET(req: Request) {
  try {
    const { success, reset } = await quizSuggestLimiter.limit(limitKey(req));
    if (!success) return tooManyRequests(reset);

    const url = new URL(req.url);
    // Allowlisted rather than sanitised: the value is interpolated into a
    // topic comparison, and an unknown tag can only ever match nothing, so
    // refusing it outright is both safer and a more honest 400.
    const interest = parseInterest(url.searchParams.get('interest'));
    if (!interest) return NextResponse.json({ error: 'Unknown interest' }, { status: 400 });

    // mentors.topics is a comma-separated string ('tech, AI/ML'), so an exact
    // tag match means splitting and trimming rather than a LIKE — 'design'
    // must not match 'instructional design', and 'co-op' must not match a
    // substring of some other tag. Same shape as notifyMatchingSeekers in
    // POST /api/mentor, which compares the seeker side of the same vocabulary.
    const visible = sql`is_open = true AND banned = false AND deleted_at IS NULL`;
    const matchesInterest = sql`EXISTS (
      SELECT 1 FROM unnest(string_to_array(lower(topics), ',')) AS topic
      WHERE btrim(topic) = ${interest.toLowerCase()}
    )`;

    const pick = async (where: ReturnType<typeof sql>) => {
      const rows = await db.execute(sql`
        SELECT id, first_name, last_name, bio, avatar_data
        FROM mentors
        WHERE ${where}
        ORDER BY random()
        LIMIT 1
      `);
      return rows.rows[0] as
        | { id: string; first_name: string; last_name: string; bio: string; avatar_data: string | null }
        | undefined;
    };

    // Fall back to any open mentor when the tag matches nobody. The reveal step
    // is the payoff of a six-step quiz and there is no "no match" screen to fall
    // back to any more, so showing someone slightly off-topic beats a dead end.
    let mentor = await pick(sql`${visible} AND ${matchesInterest}`);
    if (!mentor) mentor = await pick(visible);
    if (!mentor) return NextResponse.json({ error: 'No mentors available right now' }, { status: 404 });

    return NextResponse.json({
      mentorId: mentor.id,
      name: `${mentor.first_name} ${mentor.last_name}`.trim(),
      shortBio: shortBio(mentor.bio ?? ''),
      // Mentors have no photo — the platform uses a 16x16 pixel avatar stored as
      // an encoded string and rendered client-side by <PixelAvatar>. Named for
      // what it is rather than as `photoUrl`, which would be a URL that isn't.
      avatarData: mentor.avatar_data,
    });
  } catch (err) {
    return handleApiError(err, 'GET /api/mentors/suggest');
  }
}
