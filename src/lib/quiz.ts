/**
 * Shared vocabulary for the landing-page mentor-match quiz.
 *
 * Server-safe on purpose — no browser APIs are touched here, so route handlers
 * can import the allowlist. The cookie half lives in @/lib/quiz-session.
 */

/**
 * The single-select tag list shown in the quiz's interest step.
 *
 * Deliberately the same twenty tags the seeker onboarding screen and the seeker
 * dashboard filter already use, in the same order. They are duplicated rather
 * than imported because those two are page-local `const`s and hoisting them
 * would mean editing screens this feature has no business touching — but if
 * they ever diverge, this list is the one that decides what the API accepts.
 */
export const QUIZ_INTERESTS = [
  'tech', 'startups', 'design', 'VC', 'AI/ML', 'product', 'finance', 'research',
  'engineering', 'computer science', 'data science', 'marketing', 'consulting',
  'law', 'medicine', 'entrepreneurship', 'business', 'psychology', 'co-op',
  'grad school',
] as const;

export type QuizInterest = typeof QUIZ_INTERESTS[number];

/**
 * Narrow an untrusted value to a known tag.
 *
 * Case-insensitive because the tag makes a round trip through a cookie and a
 * query string before it gets here, but it always resolves to the canonical
 * casing from the list above ('AI/ML', not 'ai/ml') — the value is compared
 * against mentors.topics, which stores the canonical form.
 */
export function parseInterest(v: unknown): QuizInterest | null {
  if (typeof v !== 'string') return null;
  const needle = v.trim().toLowerCase();
  return QUIZ_INTERESTS.find(t => t.toLowerCase() === needle) ?? null;
}

/**
 * Merge one quiz tag into a seeker's existing comma-separated interests.
 *
 * Returns null when there is nothing to do, so callers can skip the UPDATE
 * entirely rather than writing a row back unchanged.
 *
 * Deduplicates case-insensitively and preserves the existing order and casing:
 * someone who already picked 'tech' in onboarding must not end up with
 * 'tech,tech'. The 300-character ceiling matches the one POST /api/seeker
 * enforces on the same column — if appending would breach it, the existing
 * value wins, because truncating someone's own choices to fit a tag they
 * picked before they had an account is the wrong trade.
 */
export function mergeInterest(existing: string | null | undefined, interest: string): string | null {
  const current = (existing ?? '').split(',').map(t => t.trim()).filter(Boolean);
  if (current.some(t => t.toLowerCase() === interest.toLowerCase())) return null;
  const merged = [...current, interest].join(',');
  if (merged.length > 300) return null;
  return merged;
}
