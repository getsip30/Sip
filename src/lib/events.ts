import { db } from '@/db';
import { events } from '@/db/schema';
import { logSwallowed } from '@/lib/logger';

/**
 * The product funnel, in order. The dashboard reads these left to right and
 * computes step-over-step conversion, so the array order is the funnel order —
 * changing it changes the chart.
 */
export const FUNNEL_STEPS = [
  'landing_view',
  'signup_complete',
  'profile_setup_complete',
  'browse_sips',
  'sip_requested',
  'sip_accepted',
] as const;

export type EventType = typeof FUNNEL_STEPS[number];

/** Human labels for the dashboard. Kept beside the list so they cannot drift. */
export const EVENT_LABELS: Record<EventType, string> = {
  landing_view: 'Landing view',
  signup_complete: 'Signed up',
  profile_setup_complete: 'Profile set up',
  browse_sips: 'Browsed sips',
  sip_requested: 'Sip requested',
  sip_accepted: 'Sip accepted',
};

export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && (FUNNEL_STEPS as readonly string[]).includes(value);
}

/**
 * The only events POST /api/events will accept.
 *
 * That endpoint is reachable by anyone — it has to be, since `landing_view`
 * happens before there is an account — so it must not be able to forge the
 * steps that carry meaning. `sip_accepted` written from a browser would be a
 * fabricated conversion; those events are only ever written server-side, at the
 * point the thing actually happened.
 */
export const CLIENT_LOGGABLE: readonly EventType[] = ['landing_view', 'browse_sips'];

/**
 * Record one analytics event.
 *
 * Never throws and never rejects. Analytics is not allowed to be the reason a
 * signup, a sip request or an accept fails, so every failure is swallowed into
 * the structured log and the caller carries on. That is also why callers use
 * `void logEvent(...)` rather than awaiting: the write is not on the critical
 * path of anything.
 */
export async function logEvent(
  eventType: EventType,
  {
    clerkId = null,
    userRole = null,
    metadata,
  }: {
    clerkId?: string | null;
    userRole?: 'mentor' | 'seeker' | null;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  try {
    await db.insert(events).values({ eventType, clerkId, userRole, metadata: metadata ?? null });
  } catch (err) {
    logSwallowed('events.insert_failed', err, { eventType, clerkId });
  }
}
