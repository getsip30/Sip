import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';
import { parseRange } from '@/lib/dashboard-range';
import { FUNNEL_STEPS, EVENT_LABELS } from '@/lib/events';

/**
 * Distinct people per funnel step, in order, with step-over-step conversion.
 *
 * "Distinct people" falls back to the row id when there is no Clerk id, which
 * is the only honest option for `landing_view`: a signed-out visitor cannot be
 * identified, so each view counts as one person. That inflates the first step
 * relative to a cookie-based measure and makes the landing → signup rate a
 * lower bound rather than an exact figure.
 *
 * Two further things this chart is not:
 *
 *  - It is not a cohort. Each step counts people who did that thing inside the
 *    window, not people who did the previous step and then this one. Someone who
 *    landed last month and signed up today counts in step 2 and not step 1.
 *  - `sip_accepted` can exceed `sip_requested`, because a mentor can start a 1:1
 *    from a live room that no seeker requested. Those land accepted with no
 *    matching request event.
 *
 * Both are the standard shape of an event funnel and neither is a bug, but a
 * conversion above 100% looks like one, so it is stated here and in the UI.
 */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const range = parseRange(new URL(req.url));

    const result = await db.execute(sql`
      select
        event_type,
        count(*)::int as events,
        count(distinct coalesce(clerk_id, id::text))::int as users
      from events
      where created_at >= ${range.from} and created_at < ${range.to}
      group by event_type
    `);

    const byType = new Map(
      (result.rows as { event_type: string; events: number; users: number }[])
        .map(r => [r.event_type, r])
    );

    const steps = FUNNEL_STEPS.map((step, i) => {
      const row = byType.get(step);
      const users = row?.users ?? 0;
      const prev = i === 0 ? null : (byType.get(FUNNEL_STEPS[i - 1])?.users ?? 0);

      return {
        eventType: step,
        label: EVENT_LABELS[step],
        users,
        events: row?.events ?? 0,
        // Conversion from the step before. Null for the first step (nothing to
        // convert from) and for a zero previous step, where the rate is
        // undefined rather than zero — 5 signups from 0 landings is missing
        // data, and rendering 0% would assert something false about it.
        conversionFromPrev: prev == null || prev === 0 ? null : Math.round((users / prev) * 1000) / 10,
      };
    });

    const first = steps[0].users;
    const last = steps[steps.length - 1].users;

    return NextResponse.json({
      range: { from: range.from.toISOString(), to: range.to.toISOString(), days: range.days },
      steps,
      overallConversion: first === 0 ? null : Math.round((last / first) * 1000) / 10,
    });
  } catch (err) {
    return handleApiError(err, 'GET /api/admin/dashboard/funnel');
  }
}
