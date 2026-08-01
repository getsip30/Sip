import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { publicReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { withTimeout } from '@/lib/external';
import { logError } from '@/lib/logger';

const DB_PING_TIMEOUT_MS = 3000;

export async function GET(req: Request) {
  const { success, reset } = await publicReadLimiter.limit(limitKey(req));
  if (!success) return tooManyRequests(reset);

  try {
    // Bounded so an unhealthy database makes the check fail fast instead of
    // holding the probe open until the platform timeout.
    await withTimeout('db.ping', DB_PING_TIMEOUT_MS, db.execute(sql`select 1`));
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    logError('health.db_unreachable', err);
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
