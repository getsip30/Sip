import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { flags, mentors, queueEntries, rooms, seekers } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { transporter } from '@/lib/mailer';
import { mutationLimiter } from '@/lib/ratelimit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_REASONS = ['harassment', 'inappropriate', 'noshow', 'other'];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { reportedClerkId, reportedName, reason, details } = await req.json();
    if (typeof reason !== 'string' || !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
    }
    if (typeof details !== 'string' || !details.trim() || details.length > 1000) {
      return NextResponse.json({ error: 'Details are required and must be under 1000 characters' }, { status: 400 });
    }
    if (typeof reportedClerkId !== 'string' || !reportedClerkId.trim()) {
      return NextResponse.json({ error: 'reportedClerkId required' }, { status: 400 });
    }
    if (typeof reportedName !== 'string' || !reportedName.trim() || reportedName.length > 100) {
      return NextResponse.json({ error: 'reportedName is required and must be under 100 characters' }, { status: 400 });
    }
    if (reportedClerkId === userId) {
      return NextResponse.json({ error: "You can't report yourself." }, { status: 400 });
    }

    const roomResult = await db.select().from(rooms).where(eq(rooms.id, id));
    const room = roomResult[0];
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    // Ban-check the REPORTER (either of their profiles). A banned host must still
    // be reportable, so this deliberately does not look at the room's mentor.
    const [seekerSelf, mentorSelf] = await Promise.all([
      db.select({ banned: seekers.banned }).from(seekers).where(eq(seekers.clerkId, userId)),
      db.select({ banned: mentors.banned }).from(mentors).where(eq(mentors.clerkId, userId)),
    ]);
    if (seekerSelf[0]?.banned || mentorSelf[0]?.banned) {
      return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
    }

    // Resolve the room's host once, independently of who is reporting. The old
    // version only checked this when the reporter had no mentor profile, which
    // made it impossible for a dual-role user to report the host.
    const roomMentor = (await db.select().from(mentors).where(eq(mentors.id, room.mentorId)))[0];

    // reporter must have actually been in this room
    const reporterWasMentorHere = !!roomMentor && roomMentor.clerkId === userId;
    let reporterWasSeekerHere = false;
    if (!reporterWasMentorHere) {
      const reporterEntry = await db.select().from(queueEntries).where(and(eq(queueEntries.roomId, id), eq(queueEntries.seekerClerkId, userId)));
      reporterWasSeekerHere = reporterEntry.length > 0;
    }
    if (!reporterWasMentorHere && !reporterWasSeekerHere) {
      return NextResponse.json({ error: 'You can only report someone from a room you were in.' }, { status: 403 });
    }

    // reported person must have actually been in this room too
    const reportedIsRoomMentor = !!roomMentor && roomMentor.clerkId === reportedClerkId;
    const reportedEntry = await db.select().from(queueEntries).where(and(eq(queueEntries.roomId, id), eq(queueEntries.seekerClerkId, reportedClerkId)));
    const reportedWasHere = reportedEntry.length > 0 || reportedIsRoomMentor;
    if (!reportedWasHere) {
      return NextResponse.json({ error: 'That person was not in this room.' }, { status: 400 });
    }

    // One report per reporter, per person, per room. Without this a reporter could
    // fire the rate limit's worth of accusatory emails at one target and inflate
    // the flag count that drives bans.
    const alreadyReported = await db.select({ id: flags.id }).from(flags).where(and(
      eq(flags.roomId, id),
      eq(flags.reporterClerkId, userId),
      eq(flags.reportedClerkId, reportedClerkId),
    ));
    if (alreadyReported.length > 0) {
      return NextResponse.json({ error: "You've already reported this person for this session. Our team is reviewing it." }, { status: 409 });
    }

    const reporterIsMentor = reporterWasMentorHere;
    const [flag] = await db.insert(flags).values({
      roomId: id,
      reporterClerkId: userId,
      reporterRole: reporterWasMentorHere ? 'mentor' : 'seeker',
      reportedClerkId,
      reportedName: reportedName.trim(),
      reason,
      details: details.trim(),
    }).returning();

    if (reporterIsMentor) {
      await db.update(queueEntries).set({ status: 'left' })
        .where(and(eq(queueEntries.roomId, id), eq(queueEntries.seekerClerkId, reportedClerkId), ne(queueEntries.status, 'left')));
    }

    const priorFlags = await db.select().from(flags).where(and(eq(flags.reportedClerkId, reportedClerkId), ne(flags.status, 'dismissed')));
    const flagCount = priorFlags.length;

    const client = await clerkClient();
    let reportedEmail: string | null = null;
    try {
      const reportedUser = await client.users.getUser(reportedClerkId);
      reportedEmail = reportedUser.emailAddresses[0]?.emailAddress || null;
    } catch (e) {
      console.error('Could not fetch reported user email', e);
    }

    if (reportedEmail) {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: reportedEmail,
        subject: 'Sip -- a report was filed about your session',
        text: `Hi ${reportedName},

A report was filed regarding your recent Sip session. Reason: ${reason}.

This is flag #${flagCount} on your account. Repeated flags can lead to a permanent ban.

Our team is reviewing it. If you believe this is a mistake, reply to this email.

-- Sip Team`,
      });
    }

    if (process.env.ADMIN_EMAIL) {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: process.env.ADMIN_EMAIL!,
        subject: `Sip -- new flag (${reason}) -- flag #${flagCount} for this user`,
        text: `Reporter: ${userId} (${reporterIsMentor ? 'mentor' : 'seeker'})
Reported: ${reportedName} (${reportedClerkId})
Total flags on this user: ${flagCount}
Room: ${id}
Reason: ${reason}
Details: ${details}

Review at /admin`,
      });
    }

    return NextResponse.json(flag);
  } catch (err) {
    return handleApiError(err, 'POST /api/rooms/[id]/flag');
  }
}
