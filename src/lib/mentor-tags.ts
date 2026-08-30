/**
 * Suggested tags for a mentor's profile.
 *
 * These are PROMPTS, not a taxonomy. `mentors.tags` accepts anything a mentor
 * types; this list exists so nobody faces an empty box, and so the first thing
 * they see is permission to be a person rather than a job title.
 *
 * That is why the groups are weighted the way they are: exactly one of the six
 * is about work, and it is not first. A seeker scanning twenty mentor cards
 * already knows everyone on the page is employed — what makes one of them
 * worth asking is "will talk about failing out of first year", not "leadership".
 *
 * Deliberately kept apart from TOPIC_OPTIONS in the signup form. Topics are the
 * filter; these are the texture. See the note on `mentors.tags`.
 */
export type TagGroup = { label: string; hint: string; tags: string[] };

export const TAG_GROUPS: TagGroup[] = [
  {
    label: 'how much time you have',
    hint: 'set expectations before someone asks',
    tags: [
      'free most evenings',
      'weekends work best',
      'quick chats only',
      'happy to go long',
      'slow to reply, always replies',
      'booked up but keep asking',
    ],
  },
  {
    label: 'who you like talking to',
    hint: 'the people you actually help best',
    tags: [
      'first-years welcome',
      'good with high schoolers',
      'undergrads',
      'grad students',
      'career switchers',
      'first-gen students',
      'international students',
      'people with no idea what they want',
    ],
  },
  {
    label: 'what you have been through',
    hint: 'the stuff that makes you useful',
    tags: [
      'dropped out',
      'switched careers',
      'got rejected a lot',
      'failed a startup',
      'self-taught',
      'went back to school late',
      'immigrated for work',
      'laid off and recovered',
    ],
  },
  {
    label: 'outside work',
    hint: 'yes, really',
    tags: [
      'climbing',
      'running',
      'cooking',
      'gaming',
      'music',
      'photography',
      'reading way too much',
      'plant person',
      'dog person',
      'cat person',
      'football',
      'chess',
    ],
  },
  {
    label: 'how you talk',
    hint: 'so nobody is surprised',
    tags: [
      'blunt',
      'will overshare',
      'ask me anything',
      'no small talk',
      'chaotic but helpful',
      'good listener',
    ],
  },
  {
    label: 'work-ish',
    hint: 'a couple is plenty',
    tags: [
      'hiring right now',
      'reviews resumes',
      'mock interviews',
      'reads cold emails',
      'has been on the other side of the table',
    ],
  },
];

/** Flat list of every suggestion, for membership checks. */
export const SUGGESTED_TAGS = TAG_GROUPS.flatMap(g => g.tags);

/** Hard ceiling on how many tags one profile can carry. */
export const MAX_TAGS = 12;

/** Hard ceiling on one tag's length. Long enough for a phrase, short enough to fit a pill. */
export const MAX_TAG_LENGTH = 40;

/**
 * Normalize one free-typed tag.
 *
 * Commas are stripped rather than rejected: they are the storage delimiter, and
 * silently losing one is better than an error message about a character the
 * mentor has no reason to know is special. Lowercased so "Climbing" and
 * "climbing" are the same pill on a card.
 */
export function normalizeTag(raw: string): string {
  return raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
}

/**
 * Parse the stored CSV into a clean, de-duplicated, capped list.
 *
 * Used on both sides: the API normalizes before writing, and every renderer
 * calls it on the way out, so a row written before a rule changed still renders
 * within today's limits.
 */
export function parseTags(csv: string | null | undefined): string[] {
  if (!csv) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of csv.split(',')) {
    const tag = normalizeTag(part);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Inverse of parseTags, for storage. */
export function serializeTags(tags: string[]): string {
  return parseTags(tags.join(',')).join(',');
}
