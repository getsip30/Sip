/**
 * The seeker's post-sip reflection.
 *
 * Pure and free of database or Clerk imports, for the same reason @/lib/no-show
 * is: the dashboard uses this to decide whether to show the reflection view, and
 * the route uses it to decide whether to accept the write. A window enforced
 * only in the browser is not a window.
 */

/**
 * How long after the start time the reflection view replaces the upcoming one.
 *
 * An hour. It is the same figure NO_SHOW_GRACE_PERIOD_MS uses, but deliberately
 * a separate constant rather than an import: they answer different questions
 * ("is it too late to report a no-show?" versus "has the call happened yet?")
 * and tying them together would mean widening one silently moves the other.
 *
 * Sips are not booked with an end time anywhere, so an hour past the start is
 * the only honest guess at "this is over" the data supports.
 */
export const REFLECTION_OPENS_AFTER_MS = 60 * 60 * 1000;

/** Per answer. Generous — these are meant to be a couple of sentences, not an essay. */
export const MAX_ANSWER_LENGTH = 2000;

/**
 * When the reflection prompt replaces the session details. Null for a sip with
 * no time on the calendar, which is the whole point of the state before it:
 * nothing to reflect on until there is a call to have missed.
 */
export function reflectionOpensAt(scheduledAt: Date | string | null | undefined): Date | null {
  if (!scheduledAt) return null;
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start + REFLECTION_OPENS_AFTER_MS);
}

/**
 * Whether the call is far enough behind us to ask how it went.
 *
 * Computed from the stored time on every read, never from a flag some job was
 * supposed to have set. That is what makes the dashboard correct on a load that
 * happens while no cron has run.
 */
export function isReflectionOpen(
  scheduledAt: Date | string | null | undefined,
  now: number = Date.now()
): boolean {
  const opensAt = reflectionOpensAt(scheduledAt);
  return opensAt !== null && now >= opensAt.getTime();
}

/**
 * One answer, trimmed, or null if there is nothing in it.
 *
 * Returns undefined for a value that is present but not a string, so the caller
 * can tell "left blank" from "sent something that is not an answer" — the first
 * is normal and the second is a bad request.
 */
export function parseAnswer(v: unknown): string | null | undefined {
  if (v == null) return null;
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_ANSWER_LENGTH) return undefined;
  return trimmed;
}
