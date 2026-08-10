/**
 * No-show handling for scheduled 1:1s (`requests`).
 *
 * Everything here is deliberately pure and free of database or Clerk imports so
 * the marking window can be evaluated identically in the browser (to decide
 * whether to show the button) and on the server (to decide whether to accept
 * the write). A window enforced only on the client is not a window.
 */

/**
 * How long after the start time a session can still be marked a no-show.
 *
 * An hour, widened from the original ten minutes. A sip happens off Sip — on
 * Calendly, Google Meet or over email — so nobody is sitting on this dashboard
 * while they wait. Whoever was stood up gives up, does something else, and only
 * thinks to come back here later; a ten-minute window that opened at the exact
 * start time was closed by the time almost anyone would have reached it.
 */
export const NO_SHOW_GRACE_PERIOD_MS = 60 * 60 * 1000;

/**
 * How close to the start time a cancellation counts as 'cancelled_late'.
 *
 * NOT specified in the brief — 24h is a conventional default and this constant
 * is the only place it is decided. It carries no consequence today (nothing
 * reads cancelled_late yet), so it is safe to change later without a migration.
 */
export const LATE_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

export const SESSION_STATUSES = [
  'scheduled',
  'completed',
  'no_show_mentor',
  'no_show_seeker',
  'cancelled_late',
  'cancelled_ok',
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export function isSessionStatus(v: unknown): v is SessionStatus {
  return typeof v === 'string' && (SESSION_STATUSES as readonly string[]).includes(v);
}

/** Which party is being reported, and the status that implies. */
export type ReportedRole = 'mentor' | 'seeker';

export function noShowStatusFor(role: ReportedRole): SessionStatus {
  return role === 'mentor' ? 'no_show_mentor' : 'no_show_seeker';
}

/**
 * Whether a no-show can be marked right now: from the start time until the
 * grace period is up, and not a moment either side.
 *
 * Returns false for an unscheduled request, since there is no start time to
 * measure from and therefore nothing to fail to turn up to.
 */
export function isWithinNoShowWindow(scheduledAt: Date | string | null, now = Date.now()): boolean {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return false;
  return now >= start && now <= start + NO_SHOW_GRACE_PERIOD_MS;
}

/** When the marking window closes, for showing a countdown. Null if unscheduled. */
export function noShowWindowClosesAt(scheduledAt: Date | string | null): Date | null {
  if (!scheduledAt) return null;
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start + NO_SHOW_GRACE_PERIOD_MS);
}

/**
 * Whether a cancellation landed inside the late window.
 *
 * A sip with no time on the calendar can never be a late cancellation: there
 * was nothing to be late for.
 */
export function cancellationStatus(
  scheduledAt: Date | string | null,
  cancelledAt: Date | string = new Date()
): SessionStatus {
  if (!scheduledAt) return 'cancelled_ok';
  const start = new Date(scheduledAt).getTime();
  const cancelled = new Date(cancelledAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(cancelled)) return 'cancelled_ok';
  return start - cancelled <= LATE_CANCEL_WINDOW_MS ? 'cancelled_late' : 'cancelled_ok';
}
