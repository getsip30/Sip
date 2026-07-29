import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { requests, mentors, sipFeedback } from '@/db/schema';
import { eq, and, getTableColumns } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) return NextResponse.json([], { status: 400 });

    const rows = await db
      .select({
        ...getTableColumns(requests),
        mentorFirstName: mentors.firstName,
        mentorLastName: mentors.lastName,
        mentorRole: mentors.role,
        mentorCompany: mentors.company,
        mentorCalendarLink: mentors.calendarLink,
        mentorContactEmail: mentors.contactEmail,
        seekerFeedbackGiven: sipFeedback.id,
      })
      .from(requests)
      .leftJoin(mentors, eq(requests.mentorId, mentors.id))
      .leftJoin(sipFeedback, and(eq(sipFeedback.requestId, requests.id), eq(sipFeedback.role, 'seeker')))
      .where(eq(requests.seekerEmail, email));

    const enriched = rows.map(r => ({
      ...r,
      seekerFeedbackGiven: r.seekerFeedbackGiven !== null,
      mentor: r.mentorFirstName ? {
        firstName: r.mentorFirstName, lastName: r.mentorLastName,
        role: r.mentorRole, company: r.mentorCompany, calendarLink: r.mentorCalendarLink,
        contactEmail: r.mentorContactEmail,
      } : null,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    return handleApiError(err, 'GET /api/my-sips');
  }
}