import { Redis } from '@upstash/redis';
import { logWarn } from '@/lib/logger';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export type AbuseSignal =
  | 'auth_denied'        // authenticated caller hit a 403 on someone else's resource
  | 'signup'             // profile created, watched for mass account creation
  | 'rate_limited'       // burned through a limiter
  | 'moderation_flagged'; // content rejected by the moderation filter

/**
 * Thresholds are per actor per window. Crossing one emits a single warning with
 * the count, rather than one line per event, so the signal survives log volume
 * at scale.
 */
const RULES: Record<AbuseSignal, { windowSeconds: number; threshold: number }> = {
  auth_denied: { windowSeconds: 300, threshold: 10 },
  signup: { windowSeconds: 3600, threshold: 15 },
  rate_limited: { windowSeconds: 600, threshold: 25 },
  moderation_flagged: { windowSeconds: 3600, threshold: 5 },
};

/**
 * Count an abuse-relevant event and warn once when an actor crosses the
 * threshold. Never throws and never blocks the caller: this is telemetry, and a
 * Redis blip must not fail a request that otherwise succeeded.
 */
export async function recordAbuseSignal(
  signal: AbuseSignal,
  actor: string,
  fields: Record<string, unknown> = {}
): Promise<void> {
  const rule = RULES[signal];
  const key = `abuse:${signal}:${actor}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, rule.windowSeconds);

    // Fire exactly on the crossing so a sustained attacker produces one alert
    // per window instead of one per request.
    if (count === rule.threshold) {
      logWarn('abuse.threshold_crossed', {
        signal,
        actor,
        count,
        windowSeconds: rule.windowSeconds,
        ...fields,
      });
    }
  } catch {
    // Deliberately silent: telemetry must never affect the response.
  }
}
