import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { asks, mentors } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { transporter } from '@/lib/mailer';
import { mutationLimiter } from '@/lib/ratelimit';
import { moderateQuestion } from '@/lib/groq';
import { escapeHtml } from '@/lib/utils';
import { seekers, flags } from '@/db/schema';
import { ne } from 'drizzle-orm';

const WEEKLY_CAP = 2;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { success } = await mutationLimiter.limit(userId);
  if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

  const { mentorId, question, consentToShow } = await req.json();
  if (!mentorId || !question) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (question.length > 500) return NextResponse.json({ error: 'Question is too long' }, { status: 400 });

  const mentorResult = await db.select().from(mentors).where(eq(mentors.id, mentorId));
  const mentor = mentorResult[0];
  if (!mentor) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
  if (mentor.clerkId === userId) {
    return NextResponse.json({ error: "You can't ask yourself a question." }, { status: 403 });
  }

  const seekerCheck = await db.select().from(seekers).where(eq(seekers.clerkId, userId));
  if (seekerCheck[0]?.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const seekerEmail = user.emailAddresses[0]?.emailAddress || '';
  const seekerName = user.firstName || 'Someone';

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentAsks = await db.select().from(asks).where(and(eq(asks.seekerClerkId, userId), eq(asks.mentorId, mentorId), gte(asks.createdAt, weekAgo)));
  if (recentAsks.length >= WEEKLY_CAP) {
    return NextResponse.json({ error: `You can only ask ${WEEKLY_CAP} questions per mentor per week.` }, { status: 429 });
  }

  const created = await db.insert(asks).values({ mentorId, seekerClerkId: userId, seekerName, seekerEmail, question, seekerConsentToShow: !!consentToShow }).returning();
  
  (async () => {
    const moderation = await moderateQuestion(question);
    if (moderation.flagged) {
      await db.delete(asks).where(eq(asks.id, created[0].id));
      return;
    }
    const priorFlags = await db.select().from(flags).where(and(eq(flags.reportedClerkId, userId), ne(flags.status, 'dismissed')));
    const flagWarning = priorFlags.length > 0
      ? `<p style="color:#F59E0B;font-size:13px;margin-bottom:16px;">Heads up: this person has been flagged ${priorFlags.length} time${priorFlags.length > 1 ? 's' : ''} before.</p>`
      : '';
    await transporter.sendMail({
      from: `Sip <${process.env.GMAIL_USER}>`,
      to: mentor.email,
      subject: `${seekerName} asked you a quick question on Sip`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
          <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
          <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Quick question from ${escapeHtml(seekerName)}</h2>
          <p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">"${escapeHtml(question)}"</p>
          ${flagWarning}
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Answer in Dashboard →</a>
        </div>
      `,
    });
  })().catch(err => console.error('moderation/email failed:', err));
  
  return NextResponse.json(created[0]);
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const mine = url.searchParams.get('mine');

  if (mine === 'true') {
    const result = await db.select().from(asks).where(eq(asks.seekerClerkId, userId));
    return NextResponse.json(result.reverse());
  }

  const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
  if (!mentorResult[0]) return NextResponse.json([]);
  const result = await db.select().from(asks).where(eq(asks.mentorId, mentorResult[0].id));
  return NextResponse.json(result.reverse());
}