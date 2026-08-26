import { neon } from '@neondatabase/serverless';

/**
 * How stale `last_active_at` is allowed to get before a request refreshes it.
 *
 * Fifteen minutes, not zero. The only reader counts users active in the last
 * seven days, so this granularity is invisible in the metric, while writing on
 * every request would put a database round-trip behind every page load and
 * every poll — the admin page alone refetches five endpoints every ten seconds.
 */
export const ACTIVITY_THROTTLE_MS = 15 * 60 * 1000;

/**
 * Clerk ids touched recently by this instance, so a burst of requests from one
 * person costs one write rather than one per request.
 *
 * A best-effort optimisation, not the throttle itself. Edge instances are
 * per-region and short-lived, so this misses often; the SQL below is what
 * actually guarantees the interval, and it stays correct with the cache empty.
 */
const recentlySeen = new Map<string, number>();
const CACHE_MAX = 5000;

let sql: ReturnType<typeof neon> | null = null;
function client() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    sql = neon(url);
  }
  return sql;
}

/**
 * Stamp `last_active_at` for whichever of mentors/seekers this Clerk id owns.
 *
 * One statement, not a read followed by a write: the WHERE clause is the
 * throttle, so there is nothing to check first and nothing to race against. Two
 * concurrent requests both issue the UPDATE and the second matches no rows.
 *
 * Both tables are touched because a person can hold both roles, and the caller
 * (middleware) has only a Clerk id — working out which tables they own would
 * cost the read this is built to avoid. A row that does not exist simply does
 * not match.
 *
 * `neon()` directly rather than the Drizzle client: this runs in Edge
 * middleware on every request, and importing `@/db` would pull the whole schema
 * module into that bundle for one UPDATE.
 */
export async function touchLastActive(clerkId: string): Promise<void> {
  const now = Date.now();
  const seen = recentlySeen.get(clerkId);
  if (seen != null && now - seen < ACTIVITY_THROTTLE_MS) return;

  // Evict wholesale rather than tracking an LRU. The map is a latency
  // optimisation; losing it costs one extra no-op UPDATE per active user.
  if (recentlySeen.size >= CACHE_MAX) recentlySeen.clear();
  recentlySeen.set(clerkId, now);

  const db = client();
  if (!db) return;

  try {
    const cutoff = new Date(now - ACTIVITY_THROTTLE_MS);
    await db`
      with m as (
        update mentors set last_active_at = now()
        where clerk_id = ${clerkId}
          and (last_active_at is null or last_active_at < ${cutoff})
        returning 1
      ), s as (
        update seekers set last_active_at = now()
        where clerk_id = ${clerkId}
          and (last_active_at is null or last_active_at < ${cutoff})
        returning 1
      )
      select 1
    `;
  } catch {
    // Deliberately silent, and not routed through the logger: this runs in
    // middleware on every request, so a database blip would otherwise emit one
    // log line per request. Activity tracking is the least important thing
    // happening in this request and must never affect it.
    recentlySeen.delete(clerkId);
  }
}
