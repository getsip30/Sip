import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { asks, mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { transporter } from '@/lib/mailer';
import { handleApiError } from '@/lib/api-handler';
import { escapeHtml } from '@/lib/utils';
import { isUuid, cleanText } from '@/lib/validate';
import { mutationLimiter } from '@/lib/ratelimit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    const mentor = mentorResult[0];
    if (!mentor) return NextResponse.json({ error: 'No mentor profile' }, { status: 403 });
    if (mentor.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    const { answer, showPublicly } = await req.json();
    const cleanAnswer = cleanText(answer, 1000);
    if (!cleanAnswer) return NextResponse.json({ error: 'Answer is required and must be under 1000 characters' }, { status: 400 });

    const existing = await db.select().from(asks).where(eq(asks.id, id));
    if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing[0].mentorId !== mentor.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const updated = await db.update(asks)
      .set({ answer: cleanAnswer, status: 'answered', answeredAt: new Date(), mentorConsentToShow: !!showPublicly })
      .where(eq(asks.id, id))
      .returning();

    const a = updated[0];

    transporter.sendMail({
      from: `Sip <${process.env.GMAIL_USER}>`,
      to: a.seekerEmail,
      subject: `${mentor.firstName} answered your question`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
          <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
          <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">${escapeHtml(mentor.firstName)} answered you</h2>
          <p style="color:#8B949E;font-size:13px;margin-bottom:8px;">You asked:</p>
          <p style="color:#C9D1D9;font-size:14px;line-height:1.7;margin-bottom:16px;">"${escapeHtml(a.question)}"</p>
          <p style="color:#8B949E;font-size:13px;margin-bottom:8px;">Their answer:</p>
          <p style="color:#C9D1D9;font-size:14px;line-height:1.7;margin-bottom:24px;">"${escapeHtml(a.answer ?? '')}"</p>        
        </div>
      `,
    }).catch(err => console.error('answer email failed:', err));

    return NextResponse.json(a);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/asks/[id]');
  }
}