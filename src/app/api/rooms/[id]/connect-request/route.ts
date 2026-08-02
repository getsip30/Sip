import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { requests, mentors, seekers, rooms, queueEntries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse, after } from 'next/server';
import { transporter } from '@/lib/mailer';
import { handleApiError } from '@/lib/api-handler';
import { logSwallowed } from '@/lib/logger';
import { escapeHtml } from '@/lib/utils';
import { resolveBookingOption, bookingEmailBlock } from '@/lib/booking';
import { isUuid } from '@/lib/validate';
import { mutationLimiter } from '@/lib/ratelimit';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: roomId } = await params;
    if (!isUuid(roomId)) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { seekerClerkId, mode = 'review', contactMethod } = await req.json();
    if (typeof seekerClerkId !== 'string' || !seekerClerkId.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (mode !== 'review' && mode !== 'link') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    if (seekerClerkId === userId) {
      return NextResponse.json({ error: "You can't send a connect request to yourself." }, { status: 403 });
    }

    const roomResult = await db.select().from(rooms).where(eq(rooms.id, roomId));
    const room = roomResult[0];
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.id, room.mentorId));
    const mentor = mentorResult[0];
    if (!mentor || mentor.clerkId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (mentor.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    // The seeker must actually have been in this room — otherwise a mentor could
    // fire connect requests at any clerkId they happen to know.
    const attended = await db.select({ id: queueEntries.id }).from(queueEntries)
      .where(and(eq(queueEntries.roomId, roomId), eq(queueEntries.seekerClerkId, seekerClerkId)));
    if (attended.length === 0) {
      return NextResponse.json({ error: 'That person was not in this room.' }, { status: 403 });
    }

    const seekerResult = await db.select().from(seekers).where(eq(seekers.clerkId, seekerClerkId));
    const seeker = seekerResult[0];
    if (!seeker) return NextResponse.json({ error: 'Seeker not found' }, { status: 404 });
    if (seeker.banned) return NextResponse.json({ error: 'That account has been suspended.' }, { status: 403 });

    // Name comes from the seeker's own profile, not the caller's request body.
    const seekerName = [seeker.firstName, seeker.lastName].filter(Boolean).join(' ') || 'Someone';

    const existingOpen = await db.select().from(requests).where(and(eq(requests.mentorId, mentor.id), eq(requests.seekerClerkId, seekerClerkId)));
    const hasOpenRequest = existingOpen.some(r => r.status === 'pending' || (r.status === 'accepted' && !r.sipCountedAt));
    if (hasOpenRequest) {
      return NextResponse.json({ error: 'There is already an open request between you and this seeker.' }, { status: 409 });
    }

    // "Send my link now" resolves the booking option up front, because there is
    // no later accept step to fall back on if the mentor has nothing on file.
    const option = mode === 'link' ? resolveBookingOption(mentor, contactMethod) : null;
    if (mode === 'link' && !option) {
      return NextResponse.json(
        { error: 'Add a calendar link or contact email to your profile before sending it.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const created = await db.insert(requests).values({
      mentorId: mentor.id,
      originRoomId: roomId,
      seekerClerkId,
      seekerName,
      seekerEmail: seeker.email,
      seekerLinkedin: seeker.linkedin || null,
      message: `${mentor.firstName} wants to continue as a 1:1 after your sip.`,
      // A direct send has already been decided, so it lands accepted rather than
      // sitting in a pending state neither side is waiting on.
      status: mode === 'link' ? 'accepted' : 'pending',
      respondedAt: mode === 'link' ? now : null,
      linkSentAt: mode === 'link' ? now : null,
      sharedContactMethod: option?.method ?? null,
      mentorConsentToShow: true,
    }).returning();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const mentorName = `${escapeHtml(mentor.firstName)} ${escapeHtml(mentor.lastName)}`;

    const email = option
      ? {
          subject: `${mentor.firstName} wants to do a 1:1 with you`,
          html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
          <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
          <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Book a time with ${escapeHtml(mentor.firstName)}</h2>
          <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;"><strong>${mentorName}</strong> enjoyed your sip and wants to do a 1:1 with you.</p>
          ${bookingEmailBlock(option)}
          <p style="color:#8B949E;font-size:13px;margin-top:24px;">No need to wait on a reply, the time is yours to pick.</p>
        </div>
      `,
        }
      : {
          subject: `${mentor.firstName} wants to continue as a 1:1`,
          html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
          <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
          <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Your mentor wants to keep talking</h2>
          <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;"><strong>${mentorName}</strong> enjoyed your conversation and would like to schedule a proper 1:1.</p>
          <a href="${appUrl}/dashboard" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">View in Dashboard →</a>
        </div>
      `,
        };

    after(() => transporter.sendMail({
      from: `Sip <${process.env.GMAIL_USER}>`,
      to: seeker.email,
      subject: email.subject,
      html: email.html,
    }).catch(err => logSwallowed('email.connect_request_failed', err, { roomId, seekerClerkId, mode })));

    return NextResponse.json(created[0]);
  } catch (err) {
    return handleApiError(err, 'POST /api/rooms/[id]/connect-request');
  }
}