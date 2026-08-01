import { db } from '@/db';
import { requests, mentors, seekers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { transporter } from '@/lib/mailer';
import { auth } from '@clerk/nextjs/server';
import { getUserEmail } from '@/lib/clerk';
import { emailLimiter } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { logSwallowed } from '@/lib/logger';
import { escapeHtml } from '@/lib/utils';
import { isUuid } from '@/lib/validate';
import { flags } from '@/db/schema';
import { ne, and } from 'drizzle-orm';

// No \s here: newlines/tabs must not reach the outbound Subject header.
const NAME_REGEX = /^[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0900-\u097F\u4E00-\u9FFF '.-]+$/;

export async function POST(req: Request) {
  try {
    // Sign-in required. This endpoint sends mail from our domain to an address
    // supplied in the request body, so leaving it open made it a relay: anyone
    // could push arbitrary text into any mentor's inbox, and point the follow-up
    // acceptance mail at an unrelated third party.
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Please sign in to send a sip request.' }, { status: 401 });
    }

    const { success } = await emailLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Try again in a bit.' }, { status: 429 });

    const { mentorId, seekerName, message } = await req.json();
    if (!mentorId || !seekerName || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (!isUuid(mentorId)) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    if (typeof message !== 'string' || message.length > 1000) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }
    if (typeof seekerName !== 'string' || seekerName.length > 100 || !NAME_REGEX.test(seekerName)) {
      return NextResponse.json({ error: 'Name cannot contain numbers' }, { status: 400 });
    }

    // The email is taken from the verified Clerk identity, never from the body.
    // requests.seekerEmail is later used to authorise cancel/schedule/feedback,
    // so it must not be attacker-supplied.
    const seekerEmail = await getUserEmail(userId);
    if (!seekerEmail) return NextResponse.json({ error: 'No email on your account.' }, { status: 400 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.id, mentorId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    if (mentor.banned) return NextResponse.json({ error: 'This mentor is not accepting requests.' }, { status: 403 });

    const seekerCheck = await db.select().from(seekers).where(eq(seekers.clerkId, userId));
    if (seekerCheck[0]?.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    if (mentor.clerkId === userId) {
      return NextResponse.json({ error: "You can't send a sip request to your own mentor profile." }, { status: 403 });
    }
    if (mentor.email && mentor.email.toLowerCase() === seekerEmail.toLowerCase()) {
      return NextResponse.json({ error: "You can't send a sip request to your own mentor profile." }, { status: 403 });
    }

    const existingOpen = await db.select().from(requests).where(
      and(eq(requests.mentorId, mentorId), eq(requests.seekerClerkId, userId))
    );
    const hasOpenRequest = existingOpen.some(r => r.status === 'pending' || (r.status === 'accepted' && !r.sipCountedAt));
    if (hasOpenRequest) {
      return NextResponse.json({ error: "You already have an open request with this mentor." }, { status: 409 });
    }

    const seekerLinkedin = seekerCheck[0]?.linkedin || null;

    const created = await db.insert(requests).values({
      mentorId, seekerClerkId: userId, seekerName, seekerEmail, seekerLinkedin, message, status: 'pending',
    }).returning();

    let flagWarning = '';
    const priorFlags = await db.select().from(flags).where(and(eq(flags.reportedClerkId, userId), ne(flags.status, 'dismissed')));
    if (priorFlags.length > 0) {
      flagWarning = `<p style="color:#F59E0B;font-size:13px;margin-bottom:16px;">Heads up: this person has been flagged ${priorFlags.length} time${priorFlags.length > 1 ? 's' : ''} before.</p>`;
    }

    transporter.sendMail({
      from: `Sip <${process.env.GMAIL_USER}>`,
      to: mentor.email,
      subject: `${seekerName} wants to sip with you`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
          <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
          <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">New sip request</h2>
          <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:8px;"><strong>${escapeHtml(seekerName)}</strong> (${escapeHtml(seekerEmail)}) wants to connect:</p>
          <p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">"${escapeHtml(message)}"</p>
          ${flagWarning}
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">View in Dashboard →</a>
        </div>
      `,
    }).catch(err => logSwallowed('email.new_request_failed', err, { mentorId }));

    return NextResponse.json(created[0]);
  } catch (err) {
    return handleApiError(err, 'POST /api/request');
  }
}