import { auth } from '@clerk/nextjs/server';
import { getUserEmail } from '@/lib/clerk';
import { db } from '@/db';
import { requests, mentors } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/validate';
import { transporter } from '@/lib/mailer';
import { handleApiError } from '@/lib/api-handler';
import { logSwallowed } from '@/lib/logger';
import { escapeHtml } from '@/lib/utils';
import { mutationLimiter } from '@/lib/ratelimit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    if (r.status !== 'accepted') return NextResponse.json({ error: 'Only accepted sips can be cancelled' }, { status: 400 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.id, r.mentorId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });

    let cancelledBy: 'mentor' | 'seeker';
    if (mentor.clerkId === userId) {
      cancelledBy = 'mentor';
    } else {
      const email = await getUserEmail(userId);
      if (!email || email.toLowerCase() !== r.seekerEmail.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      cancelledBy = 'seeker';
    }

    // Re-assert status in the WHERE so two concurrent cancels can't both win and
    // send duplicate mail — only the caller that flips 'accepted' gets rows back.
    const updated = await db.update(requests)
      .set({ status: 'cancelled', cancelledAt: new Date(), cancelledBy })
      .where(and(eq(requests.id, id), eq(requests.status, 'accepted')))
      .returning();

    if (!updated[0]) return NextResponse.json({ error: 'Request was already cancelled' }, { status: 409 });

    const notifyTo = cancelledBy === 'mentor' ? r.seekerEmail : mentor.email;
    const cancellerName = cancelledBy === 'mentor' ? `${mentor.firstName} ${mentor.lastName}` : r.seekerName;

    transporter.sendMail({
      from: `Sip <${process.env.GMAIL_USER}>`,
      to: notifyTo,
      subject: `Your sip was cancelled`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
          <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
          <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Sip cancelled</h2>
          <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:24px;">
          ${escapeHtml(cancellerName)} cancelled your upcoming sip. Sorry about that. Check back on Sip whenever you're ready.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="display:inline-block;background:#161B22;color:#70B5F9;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;border:1px solid rgba(112,181,249,0.3);">Back to Sip →</a>
        </div>
      `,
    }).catch(err => logSwallowed('email.cancel_failed', err, { requestId: id }));

    return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/requests/[id]/cancel');
  }
}