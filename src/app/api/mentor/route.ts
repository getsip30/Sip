import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { mentors, seekers, referralEvents } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { NextResponse, after } from 'next/server';
import { transporter } from '@/lib/mailer';
import { generateUniqueReferralCode } from '@/lib/referral';
import { publicMentor } from '@/lib/mentor';
import { escapeHtml, safeExternalUrl } from '@/lib/utils';
import { mutationLimiter, limitKey } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { logSwallowed } from '@/lib/logger';
import { recordAbuseSignal } from '@/lib/abuse';

async function notifyMatchingSeekers(mentor: typeof mentors.$inferSelect) {
  const mentorTopics = mentor.topics.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  if (mentorTopics.length === 0) return;

  const matchRows = await db.execute(sql`
    SELECT * FROM seekers
    WHERE email IS NOT NULL
      AND (last_match_email_at IS NULL OR last_match_email_at < now() - interval '7 days')
      AND string_to_array(lower(interests), ',') && ${mentorTopics}::text[]
  `);
  const matches = matchRows.rows as (typeof seekers.$inferSelect)[];

  for (const seeker of matches) {
    if (!seeker.email) continue;
    await db.update(seekers).set({ lastMatchEmailAt: new Date() }).where(eq(seekers.id, seeker.id));
    await transporter.sendMail({
      from: `Sip <${process.env.GMAIL_USER}>`,
      to: seeker.email,
      subject: `A mentor matching your interests just joined Sip`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
          <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
          <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">New mentor for you</h2>
          <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:8px;"><strong>${escapeHtml(mentor.firstName)} ${escapeHtml(mentor.lastName)}</strong>, ${escapeHtml(mentor.role)} @ ${escapeHtml(mentor.company)}, just opened up on Sip.</p>
          <p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">Topics: ${escapeHtml(mentor.topics)}</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/seekers" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">View Mentor →</a>
        </div>
      `,
    });
  }
}

export async function POST(req: Request) {
  try {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { success } = await mutationLimiter.limit(userId);
  if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

  const body = await req.json();
  const { firstName, lastName, role, company, bio, topics, calendarLink, contactEmail, availability, linkedin, showLinkedin, avatarData, ref } = body;

  if (!firstName || !lastName || !role || !company) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Account email comes from the verified Clerk identity, never the request body.
  // It was previously attacker-supplied, which allowed pointing a profile's
  // notifications at someone else's inbox (and squatting their unique email).
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No email on your account.' }, { status: 400 });
  if (bio && bio.length > 500) return NextResponse.json({ error: 'Bio is too long' }, { status: 400 });
  if (topics && topics.length > 300) return NextResponse.json({ error: 'Topics field is too long' }, { status: 400 });
  if (firstName.length > 50 || lastName.length > 50 || role.length > 100 || company.length > 100) {
    return NextResponse.json({ error: 'One of the fields is too long' }, { status: 400 });
  }

  // These are rendered as hrefs in outbound email and on the seeker dashboard.
  // The signup form checks them client-side only, so validate here too.
  const safeCalendarLink = calendarLink ? safeExternalUrl(calendarLink) : null;
  if (calendarLink && !safeCalendarLink) {
    return NextResponse.json({ error: 'Calendar link must be a valid http(s) URL' }, { status: 400 });
  }
  const safeLinkedin = linkedin ? safeExternalUrl(linkedin) : null;
  if (linkedin && !safeLinkedin) {
    return NextResponse.json({ error: 'LinkedIn must be a valid http(s) URL' }, { status: 400 });
  }
  if (contactEmail && (typeof contactEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) {
    return NextResponse.json({ error: 'Enter a valid contact email' }, { status: 400 });
  }
  if (avatarData && (typeof avatarData !== 'string' || avatarData.length > 256)) {
    return NextResponse.json({ error: 'Invalid avatar' }, { status: 400 });
  }

  const existing = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
  if (existing[0]?.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

  if (existing.length > 0) {
    const updated = await db.update(mentors)
      .set({ firstName, lastName, email, role, company, bio: bio || '', topics: topics || '', calendarLink: safeCalendarLink, contactEmail: contactEmail || null, availability: availability || 'flexible', linkedin: safeLinkedin, showLinkedin: !!showLinkedin, avatarData: avatarData || null })      .where(eq(mentors.clerkId, userId))
      .returning();
    return NextResponse.json(updated[0]);
  }

  let invitedByClerkId: string | null = null;
  if (ref) {
    const referrerMentor = await db.select().from(mentors).where(eq(mentors.referralCode, ref));
    const referrerSeeker = referrerMentor.length === 0 ? await db.select().from(seekers).where(eq(seekers.referralCode, ref)) : [];
    invitedByClerkId = referrerMentor[0]?.clerkId || referrerSeeker[0]?.clerkId || null;
  }

  const referralCode = await generateUniqueReferralCode();
  const mentor = await db.insert(mentors).values({
    clerkId: userId, firstName, lastName, email, role, company, bio: bio || '', topics: topics || '',    calendarLink: safeCalendarLink, contactEmail: contactEmail || null, availability: availability || 'flexible', linkedin: safeLinkedin, showLinkedin: !!showLinkedin,
    avatarData: avatarData || null,
    referralCode,
    invitedByClerkId,
  }).returning();

  if (invitedByClerkId) {
    await db.insert(referralEvents).values({
      referrerClerkId: invitedByClerkId,
      referredClerkId: userId,
      referredRole: 'mentor',
      milestone: 'signed_up',
    });
  }

  void recordAbuseSignal('signup', limitKey(req, userId), { role: 'mentor' });
  after(() => notifyMatchingSeekers(mentor[0]).catch(err => logSwallowed('email.new_mentor_match_failed', err, { mentorId: mentor[0].id })));

  return NextResponse.json(mentor[0]);
  } catch (err) {
    return handleApiError(err, 'POST /api/mentor');
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const all = url.searchParams.get('all');
  const leaderboard = url.searchParams.get('leaderboard');

  if (leaderboard === 'true') {
    const result = await db.select().from(mentors).where(eq(mentors.banned, false)).orderBy(desc(mentors.xp)).limit(10);
    return NextResponse.json(result.map(publicMentor));
  }

  if (all === 'true') {
    const { userId: viewerId } = await auth();
    const result = await db.select().from(mentors).where(and(eq(mentors.isOpen, true), eq(mentors.banned, false))).orderBy(desc(mentors.createdAt));
    return NextResponse.json(result.filter(m => m.clerkId !== viewerId).map(publicMentor));
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
  const m = result[0];
  if (!m) return NextResponse.json(null, { status: 404 });

  let referrerName: string | null = null;
  if (m.invitedByClerkId) {
    const referrerMentor = await db.select().from(mentors).where(eq(mentors.clerkId, m.invitedByClerkId));
    referrerName = referrerMentor[0] ? `${referrerMentor[0].firstName} ${referrerMentor[0].lastName}` : null;
  }

  return NextResponse.json({ ...m, referrerName }, { status: 200 });
}

export async function PATCH(req: Request) {
  try {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
  if (!existing[0]) return NextResponse.json({ error: 'No mentor profile' }, { status: 404 });
  if (existing[0].banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
  const wasOpen = existing[0].isOpen;

  const { isOpen } = await req.json();
  if (typeof isOpen !== 'boolean') return NextResponse.json({ error: 'isOpen must be true or false' }, { status: 400 });

  const updated = await db.update(mentors).set({ isOpen }).where(eq(mentors.clerkId, userId)).returning();
  if (!updated[0]) return NextResponse.json({ error: 'No mentor profile' }, { status: 404 });

  const COOLDOWN_MS = 60 * 60 * 1000;
  const lastNotified = updated[0].lastOpenNotifiedAt ? new Date(updated[0].lastOpenNotifiedAt).getTime() : 0;
  const canNotify = Date.now() - lastNotified > COOLDOWN_MS;

  if (isOpen && !wasOpen && canNotify) {
    await db.update(mentors).set({ lastOpenNotifiedAt: new Date() }).where(eq(mentors.id, updated[0].id));
    after(() => notifyMatchingSeekers(updated[0]).catch(err => logSwallowed('email.reopened_mentor_match_failed', err, { mentorId: updated[0].id })));
  }

  return NextResponse.json(updated[0]);
  } catch (err) {
    return handleApiError(err, 'PATCH /api/mentor');
  }
}
