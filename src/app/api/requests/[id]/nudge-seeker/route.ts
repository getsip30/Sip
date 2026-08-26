import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { requests, mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { recordAbuseSignal } from '@/lib/abuse';
import { isUuid } from '@/lib/validate';
import { transporter } from '@/lib/mailer';
import { claimMentorNudge, seekerNudgeEmail } from '@/lib/mentor-actions';

/**
 * "Nudge them" from the mentor's no-time-set email.
 *
 * POST, and reached through a signed-in page rather than straight from the
 * emailed link, for the reason spelled out on POST /api/confirm/[token]: mail
 * scanners fetch every URL in an inbound message, and a GET that sent an email
 * would fire for mentors who never opened theirs.
 *
 * Mentor only. The seeker already has their own nudges on the daily cron; this
 * is the mentor choosing to add a personal one.
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
      void recordAbuseSignal('auth_denied', userId, { route: 'requests.nudge_seeker', requestId: id });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (mentor.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    if (r.status !== 'accepted') {
      return NextResponse.json({ error: 'Only accepted sips can be nudged' }, { status: 400 });
    }
    // The nudge says "you haven't picked a date yet". Once a time exists that
    // sentence is false, so the button is refused rather than sent anyway.
    if (r.scheduledAt) {
      return NextResponse.json({ error: 'This sip already has a time booked.' }, { status: 400 });
    }

    // Claim before sending, so a double-click or two tabs cannot send twice.
    // Also the 24h cooldown: the same claim answers both questions.
    if (!(await claimMentorNudge(r.id))) {
      return NextResponse.json(
        { error: 'You nudged them recently. Give it a day before trying again.' },
        { status: 409 }
      );
    }

    await transporter.sendMail({
      from: `Sip <${process.env.GMAIL_USER}>`,
      ...seekerNudgeEmail({
        seekerEmail: r.seekerEmail,
        seekerName: r.seekerName,
        mentorFirstName: mentor.firstName,
      }),
    });

    return NextResponse.json({ nudged: true });
  } catch (err) {
    return handleApiError(err, 'POST /api/requests/[id]/nudge-seeker');
  }
}
