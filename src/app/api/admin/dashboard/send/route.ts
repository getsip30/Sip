import { db } from '@/db';
import { mentors, seekers } from '@/db/schema';
import { and, eq, isNull, isNotNull, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';
import { escapeHtml, subjectSafe } from '@/lib/utils';
import { sendAndLog, type EmailAudience, type LoggedRecipient } from '@/lib/email-log';

/**
 * Broadcasts run long: recipients are sent at a deliberately modest concurrency
 * to stay inside Resend's rate limit, so a few hundred people takes minutes
 * rather than seconds.
 */
export const maxDuration = 300;

/**
 * Hard ceiling on one broadcast.
 *
 * Not a guess at how many users Sip has — a guard on what this shape of code can
 * finish inside one function invocation. Sending one request per recipient at
 * roughly two per second, a few hundred is the honest limit before this needs
 * Resend's batch endpoint or a queue behind it. Going past the cap is reported
 * rather than silently truncated, so nobody believes a broadcast reached
 * everyone when it reached the first 200 of them.
 */
const MAX_RECIPIENTS = 200;

/** Resend's default account limit is 2 requests/second. Stay under it. */
const CONCURRENCY = 2;

const AUDIENCES: EmailAudience[] = ['all_seekers', 'all_mentors', 'everyone', 'specific'];

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

/**
 * Resolve an audience to a deduplicated recipient list.
 *
 * Banned accounts and self-deleted tombstones are excluded everywhere. A
 * deleted account's row survives (nine tables cascade off it) with its address
 * scrubbed, so mailing it would at best bounce and at worst reach someone who
 * asked to be forgotten.
 *
 * Dedupe is on the lowercased address, which matters for 'everyone': one person
 * holding both a mentor and a seeker profile has two rows and must still only
 * get one email. Whichever role is seen first wins the attribution on the log
 * row; that is cosmetic, and the alternative is logging the same send twice.
 */
async function resolveRecipients(
  audience: EmailAudience,
  specificEmail?: string
): Promise<LoggedRecipient[]> {
  if (audience === 'specific') {
    if (!isEmail(specificEmail)) return [];

    const [seeker] = await db.select({ clerkId: seekers.clerkId })
      .from(seekers).where(eq(seekers.email, specificEmail)).limit(1);
    if (seeker) return [{ email: specificEmail, clerkId: seeker.clerkId, role: 'seeker' }];

    const [mentor] = await db.select({ clerkId: mentors.clerkId })
      .from(mentors).where(eq(mentors.email, specificEmail)).limit(1);
    if (mentor) return [{ email: specificEmail, clerkId: mentor.clerkId, role: 'mentor' }];

    // Not a known account. Still allowed — this is how the admin mails someone
    // who has not signed up — it just has no identity to attach.
    return [{ email: specificEmail, clerkId: null, role: null }];
  }

  const wantSeekers = audience === 'all_seekers' || audience === 'everyone';
  const wantMentors = audience === 'all_mentors' || audience === 'everyone';

  const [seekerRows, mentorRows] = await Promise.all([
    wantSeekers
      ? db.select({ email: seekers.email, clerkId: seekers.clerkId })
          .from(seekers)
          .where(and(
            eq(seekers.banned, false),
            isNull(seekers.deletedAt),
            isNotNull(seekers.email),
            ne(seekers.email, '')
          ))
      : Promise.resolve([]),
    wantMentors
      ? db.select({ email: mentors.email, clerkId: mentors.clerkId })
          .from(mentors)
          .where(and(
            eq(mentors.banned, false),
            isNull(mentors.deletedAt),
            ne(mentors.email, '')
          ))
      : Promise.resolve([]),
  ]);

  const byEmail = new Map<string, LoggedRecipient>();
  for (const r of seekerRows) {
    if (!isEmail(r.email)) continue;
    byEmail.set(r.email.toLowerCase(), { email: r.email, clerkId: r.clerkId, role: 'seeker' });
  }
  for (const r of mentorRows) {
    if (!isEmail(r.email)) continue;
    const key = r.email.toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, { email: r.email, clerkId: r.clerkId, role: 'mentor' });
  }

  return [...byEmail.values()];
}

/**
 * The broadcast body, in Sip's transactional email shell.
 *
 * `content` is escaped and blank-line-separated blocks become paragraphs,
 * rather than being passed through as HTML. The admin is trusted, but a body
 * typed into a textarea is prose, not markup — a stray `<` in "revenue < target"
 * would silently eat the rest of the sentence, and treating the field as HTML
 * makes that the author's problem on every send.
 */
function broadcastHtml(subject: string, content: string) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map(block => escapeHtml(block.trim()).replace(/\n/g, '<br />'))
    .filter(Boolean)
    .map(block => `<p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin:0 0 16px;">${block}</p>`)
    .join('');

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
      <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
      <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">${escapeHtml(subject)}</h2>
      ${paragraphs}
    </div>
  `;
}

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const body = await req.json().catch(() => null) as {
      audience?: unknown; specificEmail?: unknown; subject?: unknown; content?: unknown;
    } | null;

    const audience = body?.audience as EmailAudience;
    if (!AUDIENCES.includes(audience)) {
      return NextResponse.json({ error: 'Pick a valid audience.' }, { status: 400 });
    }
    if (typeof body?.subject !== 'string' || !body.subject.trim()) {
      return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
    }
    if (typeof body?.content !== 'string' || !body.content.trim()) {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
    }
    if (body.content.length > 10000) {
      return NextResponse.json({ error: 'Content is too long.' }, { status: 400 });
    }
    if (audience === 'specific' && !isEmail(body.specificEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const subject = subjectSafe(body.subject);
    const content = body.content;
    const recipients = await resolveRecipients(
      audience,
      typeof body.specificEmail === 'string' ? body.specificEmail : undefined
    );

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'That audience has nobody in it.' }, { status: 400 });
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json({
        error: `That audience is ${recipients.length} people, over the ${MAX_RECIPIENTS} limit for one broadcast. Nothing was sent.`,
        recipientCount: recipients.length,
      }, { status: 413 });
    }

    const html = broadcastHtml(subject, content);
    let sent = 0;
    let failed = 0;

    // Fixed-size batches rather than a full fan-out: every recipient is one
    // Resend request, and firing all of them at once would trip the account rate
    // limit and turn most of the broadcast into retries.
    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      const results = await Promise.all(
        recipients.slice(i, i + CONCURRENCY).map(recipient =>
          sendAndLog({
            recipient,
            subject,
            html,
            text: content,
            emailType: 'manual_broadcast',
            audience,
          })
        )
      );
      for (const ok of results) {
        if (ok) sent++;
        else failed++;
      }
    }

    return NextResponse.json({ total: recipients.length, sent, failed });
  } catch (err) {
    return handleApiError(err, 'POST /api/admin/dashboard/send');
  }
}
