import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { requests, mentors, seekers, referralEvents } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { transporter } from '@/lib/mailer';
import { handleApiError } from '@/lib/api-handler';
import { escapeHtml, safeExternalUrl } from '@/lib/utils';
import { mutationLimiter } from '@/lib/ratelimit';
import { isUuid } from '@/lib/validate';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    if (!mentorResult[0]) return NextResponse.json({ error: 'No mentor profile' }, { status: 403 });
    const mentor = mentorResult[0];
    if (mentor.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    const { status, contactMethod, mentorNote } = await req.json();
    if (!['accepted', 'declined'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (status === 'accepted') {
      const hasBoth = !!mentor.calendarLink && !!mentor.contactEmail;
      if (hasBoth && !['calendar', 'email'].includes(contactMethod)) {
        return NextResponse.json({ error: 'Choose a contact method' }, { status: 400 });
      }
      if (!mentor.calendarLink && !mentor.contactEmail) {
        return NextResponse.json({ error: 'No calendar link or contact email on file' }, { status: 400 });
      }
    }

    const existingRequest = await db.select().from(requests).where(eq(requests.id, id));
    if (!existingRequest[0]) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (existingRequest[0].mentorId !== mentor.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existingRequest[0].status !== 'pending') {
      return NextResponse.json({ error: 'Request already responded to' }, { status: 409 });
    }

    const respondedAt = new Date();
    const updated = await db.update(requests)
      .set({ status, respondedAt, mentorNote: status === 'accepted' ? (mentorNote?.slice(0, 300) || null) : null })
      .where(and(eq(requests.id, id), eq(requests.status, 'pending')))
      .returning();

    const r = updated[0];
    if (!r) return NextResponse.json({ error: 'Request already responded to' }, { status: 409 });

    db.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (responded_at - created_at)) / 60)::int AS avg_minutes
      FROM requests
      WHERE mentor_id = ${mentor.id} AND responded_at IS NOT NULL
    `).then(r => {
      const avg = (r.rows as { avg_minutes: number | null }[])[0]?.avg_minutes;
      if (avg != null) return db.update(mentors).set({ avgResponseMinutes: avg }).where(eq(mentors.id, mentor.id));
    }).catch(err => console.error('avgResponseMinutes update failed:', err));

    if (status === 'accepted') {
      const bookingSeeker = await db.select().from(seekers).where(eq(seekers.email, r.seekerEmail));
      if (bookingSeeker[0]?.invitedByClerkId) {
        const alreadyLogged = await db.select().from(referralEvents).where(and(
          eq(referralEvents.referredClerkId, bookingSeeker[0].clerkId),
          eq(referralEvents.milestone, 'first_sip_booked')
        ));
        if (alreadyLogged.length === 0) {
          await db.insert(referralEvents).values({
            referrerClerkId: bookingSeeker[0].invitedByClerkId,
            referredClerkId: bookingSeeker[0].clerkId,
            referredRole: 'seeker',
            milestone: 'first_sip_booked',
          });
        }
      }

      const safeCalendarLink = safeExternalUrl(mentor.calendarLink);
      const useCalendar = safeCalendarLink && (contactMethod === 'calendar' || !mentor.contactEmail);
      const contactBlock = useCalendar
        ? `<a href="${escapeHtml(safeCalendarLink)}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Book Your Sip →</a>`
        : `<p style="color:#70B5F9;font-size:16px;font-weight:600;margin-bottom:0;">Book a Google Meet on this email only: ${escapeHtml(mentor.contactEmail || '')}</p>`;
      const noteBlock = r.mentorNote
        ? `<div style="background:#161B22;border:1px solid rgba(112,181,249,0.3);border-radius:12px;padding:16px 18px;margin-top:20px;"><p style="color:#8B949E;font-size:12px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Note from ${escapeHtml(mentor.firstName)}</p><p style="color:#E6EDF3;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(r.mentorNote)}</p></div>`
        : '';

      transporter.sendMail({
        from: `Sip <${process.env.GMAIL_USER}>`,
        to: r.seekerEmail,
        subject: `${mentor.firstName} accepted your sip request`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
            <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
            <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Your request was accepted</h2>
            <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;">
            <strong style="color:#E6EDF3;">${escapeHtml(mentor.firstName)} ${escapeHtml(mentor.lastName)}</strong> (${escapeHtml(mentor.role)} @ ${escapeHtml(mentor.company)}) accepted your sip request.
            </p>
            ${contactBlock}
            ${noteBlock}
            <p style="color:#8B949E;font-size:13px;margin-top:24px;">Show up curious. That's all they ask.</p>
          </div>
        `,
      }).catch(err => console.error('accept email failed:', err));
    }

    if (status === 'declined') {
      transporter.sendMail({
        from: `Sip <${process.env.GMAIL_USER}>`,
        to: r.seekerEmail,
        subject: `Update on your sip request`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
            <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
            <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Not this time</h2>
            <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;">
            ${escapeHtml(mentor.firstName)} wasn't able to connect right now. Don't sweat it. There are plenty of other people open on Sip.
            </p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="display:inline-block;background:#161B22;color:#70B5F9;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;border:1px solid rgba(112,181,249,0.3);">Browse More Mentors →</a>
          </div>
        `,
      }).catch(err => console.error('decline email failed:', err));
    }

    return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/requests/[id]');
  }
}