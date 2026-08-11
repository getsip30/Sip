import { auth } from '@clerk/nextjs/server';
import { getUserEmail } from '@/lib/clerk';
import { db } from '@/db';
import { requests, mentors, noShowReports } from '@/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { isUuid } from '@/lib/validate';
import { safeExternalUrl } from '@/lib/utils';
import { isWithinNoShowWindow, noShowStatusFor, NO_SHOW_GRACE_PERIOD_MS, type ReportedRole } from '@/lib/no-show';

/**
 * Report that the other party did not turn up.
 *
 * Logging only, by design: this writes a report row and a session status and
 * stops there. No email, no strike, no suspension. The point of this phase is
 * to find out how often it actually happens before deciding what it should cost.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const existing = await db.select().from(requests).where(eq(requests.id, id));
    const r = existing[0];
    if (!r) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.id, r.mentorId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });

    // Who is reporting decides who is reported — there is no third party to a
    // 1:1, so the role is derived rather than taken from the request body.
    let reportedRole: ReportedRole;
    if (mentor.clerkId === userId) {
      reportedRole = 'seeker';
    } else {
      const email = await getUserEmail(userId);
      const isSeeker =
        r.seekerClerkId === userId ||
        (!!email && email.toLowerCase() === r.seekerEmail.toLowerCase());
      if (!isSeeker) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      reportedRole = 'mentor';
    }

    if (r.status !== 'accepted') {
      return NextResponse.json({ error: 'Only accepted sips can be marked' }, { status: 400 });
    }
    if (!r.scheduledAt) {
      return NextResponse.json({ error: 'This sip has no scheduled time' }, { status: 400 });
    }

    // Re-checked here and not only in the browser. The client hides the button
    // outside the window; this is what actually enforces it.
    if (!isWithinNoShowWindow(r.scheduledAt)) {
      const minutes = Math.round(NO_SHOW_GRACE_PERIOD_MS / 60000);
      return NextResponse.json(
        { error: `No-shows can only be marked within ${minutes} minutes of the session starting.` },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    // A bad link is dropped rather than rejected: the evidence is optional, and
    // losing the whole report over a malformed URL helps nobody.
    const evidenceUrl = safeExternalUrl(body?.evidenceUrl);

    const reportedClerkId = reportedRole === 'mentor' ? mentor.clerkId : r.seekerClerkId;

    // The unique index on (request_id, reported_by_clerk_id) is the idempotency
    // guard, so a double-click is a no-op rather than a second report.
    const inserted = await db
      .insert(noShowReports)
      .values({
        requestId: r.id,
        reportedByClerkId: userId,
        reportedClerkId,
        reportedRole,
        evidenceUrl,
      })
      .onConflictDoNothing({ target: [noShowReports.requestId, noShowReports.reportedByClerkId] })
      .returning({ id: noShowReports.id });

    // Only the first report moves the status. If both sides mark each other the
    // second one still gets its report row (different reporter, no conflict),
    // but the session keeps the first verdict rather than flip-flopping. A
    // mutual no-show is exactly the case that wants a human to look at it.
    //
    // NULL counts as scheduled here. session_status is only written from the
    // moment a sip is scheduled, so every sip booked before this feature shipped
    // still has NULL — matching on 'scheduled' alone silently did nothing for
    // all of them, and the reporter saw the button do no visible work.
    const updated = await db
      .update(requests)
      .set({ sessionStatus: noShowStatusFor(reportedRole) })
      .where(and(
        eq(requests.id, r.id),
        or(isNull(requests.sessionStatus), eq(requests.sessionStatus, 'scheduled'))
      ))
      .returning({ sessionStatus: requests.sessionStatus });

    return NextResponse.json({
      reported: inserted.length > 0,
      sessionStatus: updated[0]?.sessionStatus ?? r.sessionStatus,
    });
  } catch (err) {
    return handleApiError(err, 'POST /api/requests/[id]/no-show');
  }
}
