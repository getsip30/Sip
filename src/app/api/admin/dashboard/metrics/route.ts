import { db } from '@/db';
import { requests } from '@/db/schema';
import { and, gte, lt, eq, sql, count, isNotNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';
import { parseRange } from '@/lib/dashboard-range';

/**
 * The three headline numbers on the admin dashboard.
 *
 * Two caveats worth knowing before reading these:
 *
 *  - `weeklyActiveUsers` ignores the date range on purpose. "Weekly active" is
 *    defined as the last seven days from now; scoping it to an arbitrary window
 *    would make the label a lie, and there is no historical activity data to
 *    compute it for a past window from anyway.
 *
 *  - `sipsAccepted` counts requests whose status is 'accepted' *right now*, by
 *    when they were responded to. A sip that was accepted and later cancelled
 *    has status 'cancelled' and is not counted, so this reads as "accepted and
 *    still standing" rather than "acceptances that occurred". The requests table
 *    keeps no acceptance timestamp separate from `respondedAt`, so the stricter
 *    reading is not available without a schema change.
 */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const range = parseRange(new URL(req.url));
    const weekAgo = new Date(Date.now() - 7 * 86400_000);

    const [wau, requested, accepted] = await Promise.all([
      // UNION rather than two counts added together: a person can hold both a
      // mentor and a seeker row under one Clerk id, and adding would count them
      // twice. UNION (not UNION ALL) dedupes on clerk_id.
      db.execute(sql`
        select count(*)::int as n from (
          select clerk_id from mentors
            where last_active_at >= ${weekAgo} and deleted_at is null and banned = false
          union
          select clerk_id from seekers
            where last_active_at >= ${weekAgo} and deleted_at is null and banned = false
        ) u
      `),
      db.select({ n: count() }).from(requests).where(
        and(gte(requests.createdAt, range.from), lt(requests.createdAt, range.to))
      ),
      db.select({ n: count() }).from(requests).where(
        and(
          eq(requests.status, 'accepted'),
          isNotNull(requests.respondedAt),
          gte(requests.respondedAt, range.from),
          lt(requests.respondedAt, range.to)
        )
      ),
    ]);

    return NextResponse.json({
      range: { from: range.from.toISOString(), to: range.to.toISOString(), days: range.days },
      weeklyActiveUsers: (wau.rows as { n: number }[])[0]?.n ?? 0,
      sipsRequested: requested[0]?.n ?? 0,
      sipsAccepted: accepted[0]?.n ?? 0,
    });
  } catch (err) {
    return handleApiError(err, 'GET /api/admin/dashboard/metrics');
  }
}
