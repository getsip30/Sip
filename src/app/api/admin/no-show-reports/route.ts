import { db } from '@/db';
import { noShowReports, requests, mentors } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';
import { safeExternalUrl } from '@/lib/utils';

/**
 * The no-show review queue.
 *
 * Both parties are resolved without touching the `seekers` table. `reportedRole`
 * already says which side was reported, and a 1:1 has only two sides, so the
 * mentor on the request and the seeker named on the request are between them
 * both people involved. Joining `seekers` would also miss the email-only
 * seekers, who have no row there at all.
 */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const rows = await db
      .select({
        id: noShowReports.id,
        requestId: noShowReports.requestId,
        reportedByClerkId: noShowReports.reportedByClerkId,
        reportedClerkId: noShowReports.reportedClerkId,
        reportedRole: noShowReports.reportedRole,
        evidenceUrl: noShowReports.evidenceUrl,
        status: noShowReports.status,
        reviewedAt: noShowReports.reviewedAt,
        createdAt: noShowReports.createdAt,
        seekerName: requests.seekerName,
        seekerEmail: requests.seekerEmail,
        scheduledAt: requests.scheduledAt,
        sessionStatus: requests.sessionStatus,
        requestStatus: requests.status,
        mentorFirstName: mentors.firstName,
        mentorLastName: mentors.lastName,
        mentorEmail: mentors.email,
      })
      .from(noShowReports)
      .leftJoin(requests, eq(noShowReports.requestId, requests.id))
      .leftJoin(mentors, eq(requests.mentorId, mentors.id))
      .orderBy(desc(noShowReports.createdAt))
      .limit(500);

    const result = rows.map(r => {
      const mentorName = r.mentorFirstName ? `${r.mentorFirstName} ${r.mentorLastName}` : 'unknown mentor';
      const seekerName = r.seekerName ?? 'unknown seeker';
      const reportedIsMentor = r.reportedRole === 'mentor';
      return {
        ...r,
        // Who did what, resolved to names for the queue.
        reportedName: reportedIsMentor ? mentorName : seekerName,
        reportedEmail: reportedIsMentor ? r.mentorEmail : r.seekerEmail,
        reporterName: reportedIsMentor ? seekerName : mentorName,
        reporterRole: reportedIsMentor ? 'seeker' : 'mentor',
        sipLabel: `${mentorName} ↔ ${seekerName}`,
        // Re-validated on the way out, not just on the way in. This is a link an
        // admin clicks, and a value that reached the column before the write-side
        // check existed — or by any other route — must not become a live href.
        evidenceUrl: safeExternalUrl(r.evidenceUrl),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'GET /api/admin/no-show-reports');
  }
}
