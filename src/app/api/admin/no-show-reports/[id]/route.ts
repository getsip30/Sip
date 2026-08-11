import { db } from '@/db';
import { noShowReports, requests } from '@/db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';
import { isUuid } from '@/lib/validate';
import { REVIEW_ACTIONS, isReviewAction, noShowStatusFor, type ReportedRole } from '@/lib/no-show';

/**
 * Resolve one no-show report.
 *
 * 'review' records that a human looked and the report stands. 'dismiss' judges
 * it wrong, and that has to reach the sip as well as the report row: the status
 * was set the moment the report was filed, and leaving it there would mean a
 * dismissed report still cost the accused their attendance rate for good.
 *
 * What the sip reverts TO is decided by whatever reports are still open, not by
 * assuming there were none. Both sides can report each other, so dismissing one
 * of two leaves a live accusation that should now be the verdict on record.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const { action } = await req.json().catch(() => ({}));
    if (!isReviewAction(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const updated = await db
      .update(noShowReports)
      .set({ status: REVIEW_ACTIONS[action], reviewedAt: new Date() })
      .where(eq(noShowReports.id, id))
      .returning();

    const report = updated[0];
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    if (action === 'dismiss') {
      // Everything still standing against this sip, oldest first — the same
      // order that decided the verdict originally.
      const stillOpen = await db
        .select({ reportedRole: noShowReports.reportedRole })
        .from(noShowReports)
        .where(and(eq(noShowReports.requestId, report.requestId), eq(noShowReports.status, 'open')))
        .orderBy(asc(noShowReports.createdAt));

      const verdict = stillOpen.length === 0
        ? 'scheduled'
        : noShowStatusFor(stillOpen[0].reportedRole as ReportedRole);

      // Guarded to sips currently carrying a no-show. If the completion cron has
      // since settled this as 'completed', or an admin got there first, that is a
      // later fact than the report being dismissed and it wins.
      //
      // Idempotent, so a retry after a partial failure lands in the same place.
      await db
        .update(requests)
        .set({ sessionStatus: verdict })
        .where(and(
          eq(requests.id, report.requestId),
          inArray(requests.sessionStatus, ['no_show_mentor', 'no_show_seeker'])
        ));
    }

    return NextResponse.json(report);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/admin/no-show-reports/[id]');
  }
}
