/**
 * The interest/topic vocabulary, in one place.
 *
 * This list previously existed as three separate literals — the seeker
 * onboarding screen's `TOPICS`, the seeker dashboard's `ALL_FILTERS`, and the
 * landing quiz's own copy. All three were byte-identical, which is exactly the
 * state in which they silently stop being: adding a tag to one screen would
 * leave the quiz unable to offer it and the dashboard unable to filter by it,
 * with nothing failing to say so.
 *
 * A plain module rather than a database table because the values are compared
 * against `mentors.topics` and `seekers.interests`, both of which store them as
 * comma-separated text. Adding a tag here is a one-line change that reaches
 * every screen at once; removing one does not orphan the rows that already hold
 * it, which is why nothing here deletes.
 *
 * ORDER IS PART OF THE CONTRACT. It is the order the chips render in on three
 * screens, so appending is safe and reordering is a visible change.
 *
 * NOT the mentor signup screen's `TOPIC_OPTIONS`. That is a deliberate
 * ten-item subset — what a mentor can offer, rather than what a seeker can ask
 * for — and folding it in here would silently widen it.
 */
export const INTEREST_TAGS = [
  'tech',
  'startups',
  'design',
  'VC',
  'AI/ML',
  'product',
  'finance',
  'research',
  'engineering',
  'computer science',
  'data science',
  'marketing',
  'consulting',
  'law',
  'medicine',
  'entrepreneurship',
  'business',
  'psychology',
  'co-op',
  'grad school',
] as const;

export type InterestTag = typeof INTEREST_TAGS[number];

/**
 * Narrow an untrusted value to a known tag.
 *
 * Case-insensitive because a tag makes a round trip through cookies, query
 * strings and a free-text database column before it gets here, but it always
 * resolves to the canonical casing from the list above ('AI/ML', not 'ai/ml').
 * Callers compare the result against `mentors.topics`, which stores the
 * canonical form.
 */
export function parseInterest(v: unknown): InterestTag | null {
  if (typeof v !== 'string') return null;
  const needle = v.trim().toLowerCase();
  return INTEREST_TAGS.find(t => t.toLowerCase() === needle) ?? null;
}
