import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Run `job` only if no other instance holds `key`, and at most once per
 * `ttlSeconds`. Returns true if this caller ran it.
 *
 * Background sweeps hang off high-traffic GETs, which at scale means hundreds of
 * instances per second would otherwise fire the same table-wide writes
 * concurrently. SET NX gives a single winner across all instances; the TTL
 * doubles as the interval and self-heals if a holder dies mid-job.
 */
export async function runOnce(key: string, ttlSeconds: number, job: () => Promise<void>): Promise<boolean> {
  let acquired = false;
  try {
    const res = await redis.set(`lock:${key}`, Date.now(), { nx: true, ex: ttlSeconds });
    acquired = res === 'OK';
  } catch (err) {
    // A Redis outage must not take the sweep's host route down with it. Skipping
    // is safe: these jobs are periodic and the next request retries.
    console.error(JSON.stringify({ level: 'error', event: 'lock.acquire_failed', key, message: String(err) }));
    return false;
  }

  if (!acquired) return false;

  try {
    await job();
    return true;
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', event: 'lock.job_failed', key, message: String(err) }));
    return false;
  }
}
