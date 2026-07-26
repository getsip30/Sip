import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { flags, rooms, mentors, queueEntries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { transporter } from '@/lib/mailer';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { reportedClerkId, reportedName, reason, details } = await req.json();
    if (!reason || !details) return NextResponse.json({ error: 'Reason and details required' }, { status: 400 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    const reporterIsMentor = mentorResult.length > 0;

    const [flag] = await db.insert(flags).values({
      roomId: id,
      reporterClerkId: userId,
      reporterRole: reporterIsMentor ? 'mentor' : 'seeker',
      reportedClerkId,
      reportedName,
      reason,
      details,
    }).returning();

    // if mentor flagged a seeker, kick them from the queue immediately
    if (reporterIsMentor) {
      await db.update(queueEntries).set({ status: 'left' })
        .where(and(eq(queueEntries.roomId, id), eq(queueEntries.seekerClerkId, reportedClerkId)));
    }

    const client = await clerkClient();
    let reportedEmail: string | null = null;
    try {
      const reportedUser = await client.users.getUser(reportedClerkId);
      reportedEmail = reportedUser.emailAddresses[0]?.emailAddress || null;
    } catch {}

    if (reportedEmail) {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: reportedEmail,
        subject: 'Sip — a report was filed about your session',
        text: `Hi ${reportedName},\n\nA report was filed regarding your recent Sip session. Reason: ${reason}.\n\nOur team is reviewing it. If you believe this is a mistake, reply to this email.\n\n— Sip Team`,
      });
    }

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL!,
      subject: `Sip — new flag (${reason})`,
      text: `Reporter: ${userId} (${reporterIsMentor ? 'mentor' : 'seeker'})\nReported: ${reportedName} (${reportedClerkId})\nRoom: ${id}\nReason: ${reason}\nDetails: ${details}\n\nReview at /admin`,
    });

    return NextResponse.json(flag);
  } catch (err) {
    return handleApiError(err, 'POST /api/rooms/[id]/flag');
  }
}