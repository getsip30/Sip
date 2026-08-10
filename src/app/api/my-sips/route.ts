import { auth } from '@clerk/nextjs/server';
import { getUserEmail } from '@/lib/clerk';
import { db } from '@/db';
import { requests, mentors, sipFeedback } from '@/db/schema';
import { eq, and, or, getTableColumns, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { privateReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { success, reset } = await privateReadLimiter.limit(limitKey(req, userId));
    if (!success) return tooManyRequests(reset);


    const email = await getUserEmail(userId);
    if (!email) return NextResponse.json([], { status: 400 });

    const rows = await db
      .select({
        ...getTableColumns(requests),
        mentorFirstName: mentors.firstName,
        mentorLastName: mentors.lastName,
        mentorRole: mentors.role,
        mentorCompany: mentors.company,
        mentorCalendarLink: mentors.calendarLink,
        mentorGoogleCalendarLink: mentors.googleCalendarLink,
        mentorContactEmail: mentors.contactEmail,
        seekerFeedbackGiven: sipFeedback.id,
      })
      .from(requests)
      .leftJoin(mentors, eq(requests.mentorId, mentors.id))
      .leftJoin(sipFeedback, and(eq(sipFeedback.requestId, requests.id), eq(sipFeedback.role, 'seeker')))
      .where(or(eq(requests.seekerClerkId, userId), eq(requests.seekerEmail, email)))
      .orderBy(desc(requests.createdAt))
      .limit(300);

    // Contact details are the payoff for an ACCEPTED request only — a pending or
    // declined request must not hand out the mentor's private booking channel.
    //
    // On top of that, only the channel the mentor actually chose is released.
    // Returning both meant a mentor who picked "email only" still had their
    // calendar link handed over, and the reverse.
    //
    // sharedContactMethod is null on requests accepted before it existed. There
    // is no record of what those seekers were shown, so they keep seeing
    // everything rather than losing a link they may already be booking through.
    // confirmToken is dropped for the same reason it is dropped in
    // GET /api/requests: it is a bearer secret for the confirm link, and it
    // arrives here only because getTableColumns takes every column.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const enriched = rows.map(({ mentorCalendarLink, mentorGoogleCalendarLink, mentorContactEmail, confirmToken: _confirmToken, ...r }) => {
      const released = r.status === 'accepted';
      const chosen = r.sharedContactMethod;
      const releases = (method: string) => released && (chosen == null || chosen === method);
      return {
        ...r,
        seekerFeedbackGiven: r.seekerFeedbackGiven !== null,
        mentor: r.mentorFirstName ? {
          firstName: r.mentorFirstName, lastName: r.mentorLastName,
          role: r.mentorRole, company: r.mentorCompany,
          calendarLink: releases('calendar') ? mentorCalendarLink : null,
          googleCalendarLink: releases('google') ? mentorGoogleCalendarLink : null,
          contactEmail: releases('email') ? mentorContactEmail : null,
        } : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    return handleApiError(err, 'GET /api/my-sips');
  }
}