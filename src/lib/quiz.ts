/**
 * Quiz-specific helpers.
 *
 * The tag vocabulary itself lives in @/lib/interests, which every screen that
 * shows these tags now imports. Nothing here redefines it.
 *
 * Server-safe on purpose — no browser APIs are touched, so route handlers can
 * import this. The cookie half lives in @/lib/quiz-session.
 */

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
