import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { requests, mentors, noShowReports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { recordAbuseSignal } from '@/lib/abuse';
import { isUuid } from '@/lib/validate';

/**
 * "Report as no-show" from the mentor's no-time-set email.
 *
 * Files a row in the EXISTING `no_show_reports` queue rather than starting a
 * second kind of tracking. Phases 1-3 already built that table, the admin
 * review states and the queue at /admin, and it reads a report with no
 * scheduled time correctly — it prints "no scheduled time" — so this needed
 * nothing new on the admin side.
 *
 * What it deliberately does NOT do is set `session_status`. Every other no-show
 * path writes 'no_show_seeker' there, but that column describes what happened at
 * the scheduled time, and this is the case where no time was ever set. Marking
 * it would be recording a session that never existed; NULL already means "never
 * got as far as having a session", which is exactly the truth here.
 *
 * Logging only, like POST /api/requests/[id]/no-show: no strike, no suspension,
 * nothing automatic. It surfaces in the review queue for a human.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const found = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
    const r = found[0];
    if (!r) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const mentorRow = await db.select().from(mentors).where(eq(mentors.id, r.mentorId)).limit(1);
    const mentor = mentorRow[0];
    if (!mentor || mentor.clerkId !== userId) {
      void recordAbuseSignal('auth_denied', userId, { route: 'requests.report_unbooked', requestId: id });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (mentor.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    if (r.status !== 'accepted') {
      return NextResponse.json({ error: 'Only accepted sips can be reported' }, { status: 400 });
    }
    if (r.scheduledAt) {
      return NextResponse.json(
        { error: 'This sip has a time booked. Use the no-show button on your dashboard instead.' },
        { status: 400 }
      );
    }

    // The unique index on (request_id, reported_by_clerk_id) makes a second
    // press a no-op rather than a second report, the same guard the existing
    // no-show route relies on.
    const inserted = await db
      .insert(noShowReports)
      .values({
        requestId: r.id,
        reportedByClerkId: userId,
        // Nullable on purpose: an email-only seeker has no Clerk id to record.
        // The report still identifies who it is about through requestId.
        reportedClerkId: r.seekerClerkId,
        reportedRole: 'seeker',
      })
      .onConflictDoNothing({ target: [noShowReports.requestId, noShowReports.reportedByClerkId] })
      .returning({ id: noShowReports.id });

    return NextResponse.json({ reported: inserted.length > 0 });
  } catch (err) {
    return handleApiError(err, 'POST /api/requests/[id]/report-unbooked');
  }
}
