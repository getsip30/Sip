import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { requests, mentors, seekers, rooms } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { transporter } from '@/lib/mailer';
import { handleApiError } from '@/lib/api-handler';
import { escapeHtml } from '@/lib/utils';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: roomId } = await params;
    const { seekerClerkId, seekerName } = await req.json();
    if (!seekerClerkId || !seekerName) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
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

    const seekerResult = await db.select().from(seekers).where(eq(seekers.clerkId, seekerClerkId));
    const seeker = seekerResult[0];
    if (!seeker) return NextResponse.json({ error: 'Seeker not found' }, { status: 404 });

    const existingOpen = await db.select().from(requests).where(and(eq(requests.mentorId, mentor.id), eq(requests.seekerClerkId, seekerClerkId)));
    const hasOpenRequest = existingOpen.some(r => r.status === 'pending' || (r.status === 'accepted' && !r.sipCountedAt));
    if (hasOpenRequest) {
      return NextResponse.json({ error: 'There is already an open request between you and this seeker.' }, { status: 409 });
    }

    const created = await db.insert(requests).values({
      mentorId: mentor.id,
      originRoomId: roomId,
      seekerClerkId,
      seekerName,
      seekerEmail: seeker.email,
      seekerLinkedin: seeker.linkedin || null,
      message: `${mentor.firstName} wants to continue as a 1:1 after your sip.`,
      status: 'pending',
      mentorConsentToShow: true,
    }).returning();

    transporter.sendMail({
      from: `Sip <${process.env.GMAIL_USER}>`,
      to: seeker.email,
      subject: `${mentor.firstName} wants to continue as a 1:1`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
          <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
          <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Your mentor wants to keep talking</h2>
          <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;"><strong>${escapeHtml(mentor.firstName)} ${escapeHtml(mentor.lastName)}</strong> enjoyed your conversation and would like to schedule a proper 1:1.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">View in Dashboard →</a>
        </div>
      `,
    }).catch(err => console.error('connect-request email failed:', err));

    return NextResponse.json(created[0]);
  } catch (err) {
    return handleApiError(err, 'POST /api/rooms/[id]/connect-request');
  }
}