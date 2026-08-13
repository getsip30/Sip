import { db } from '@/db';
import { seekers, referralEvents, mentors, requests } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { transporter } from '@/lib/mailer';
import { escapeHtml, subjectSafe } from '@/lib/utils';
import { bookingEmailBlock, type BookingOption } from '@/lib/booking';
import { logSwallowed } from '@/lib/logger';

/**
 * Everything that happens once a request reaches 'accepted', regardless of which
 * path got it there.
 *
 * Two routes now accept a request — the mentor pressing accept, and auto-accept
 * confirming it on arrival — and both owe the seeker the same email and the
 * referral chain the same milestone. Keeping that in one place is the point: a
 * seeker whose request was auto-accepted must not silently miss the booking link
 * because the second path forgot to send it.
 *
 * The row is already written by the time this runs. Nothing here is allowed to
 * fail the request: the database is the source of truth and a bounced email is
 * not a reason to tell the caller the accept did not happen.
 */

type AcceptedMentor = typeof mentors.$inferSelect;
type AcceptedRequest = typeof requests.$inferSelect;

/**
 * Records the referrer's credit the first time someone they invited books a sip.
 * Idempotent on (seeker, milestone), because a seeker books more than once.
 */
export async function recordFirstSipBooked(seekerEmail: string) {
  const bookingSeeker = await db.select().from(seekers).where(eq(seekers.email, seekerEmail)).limit(1);
  const seeker = bookingSeeker[0];
  if (!seeker?.invitedByClerkId) return;

  const alreadyLogged = await db.select().from(referralEvents).where(and(
    eq(referralEvents.referredClerkId, seeker.clerkId),
    eq(referralEvents.milestone, 'first_sip_booked')
  ));
  if (alreadyLogged.length > 0) return;

  await db.insert(referralEvents).values({
    referrerClerkId: seeker.invitedByClerkId,
    referredClerkId: seeker.clerkId,
    referredRole: 'seeker',
    milestone: 'first_sip_booked',
  });
}

/**
 * The "your request was accepted" email, carrying whichever booking method the
 * mentor actually shared.
 *
 * @param auto Adds a line explaining why there was no wait, so an instant
 *   acceptance does not read as a bot or a mistake.
 */
/**
 * The "Note from <mentor>" card that rides along with a booking link.
 *
 * Shared because three paths now hand out contact details — the dashboard
 * accept, auto-accept, and the in-room "send my link" shortcut — and a note
 * that renders differently depending on which one sent it would read as a
 * different feature. Returns '' for an absent note so callers can interpolate
 * it unconditionally.
 */
export function mentorNoteEmailBlock(mentorFirstName: string, note: string | null | undefined) {
  if (!note) return '';
  return `<div style="background:#161B22;border:1px solid rgba(112,181,249,0.3);border-radius:12px;padding:16px 18px;margin-top:20px;"><p style="color:#8B949E;font-size:12px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Note from ${escapeHtml(mentorFirstName)}</p><p style="color:#E6EDF3;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(note)}</p></div>`;
}

export function sendAcceptedEmail({
  mentor,
  request,
  option,
  auto = false,
}: {
  mentor: Pick<AcceptedMentor, 'firstName' | 'lastName' | 'role' | 'company'>;
  request: Pick<AcceptedRequest, 'id' | 'seekerEmail' | 'mentorNote'>;
  option: BookingOption | null;
  auto?: boolean;
}) {
  const contactBlock = option ? bookingEmailBlock(option) : '';
  const noteBlock = mentorNoteEmailBlock(mentor.firstName, request.mentorNote);
  const autoBlock = auto
    ? `<p style="color:#8B949E;font-size:13px;line-height:1.7;margin-bottom:20px;">${escapeHtml(mentor.firstName)} has instant booking switched on, so there was nothing to wait for. Pick a time that works and you're set.</p>`
    : '';

  return transporter.sendMail({
    from: `Sip <${process.env.GMAIL_USER}>`,
    to: request.seekerEmail,
    subject: `${subjectSafe(mentor.firstName)} accepted your sip request`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;">
        <div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div>
        <h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">Your request was accepted</h2>
        <p style="color:#C9D1D9;font-size:15px;line-height:1.7;margin-bottom:${autoBlock ? '12px' : '24px'};">
        <strong style="color:#E6EDF3;">${escapeHtml(mentor.firstName)} ${escapeHtml(mentor.lastName)}</strong> (${escapeHtml(mentor.role)} @ ${escapeHtml(mentor.company)}) accepted your sip request.
        </p>
        ${autoBlock}
        ${contactBlock}
        ${noteBlock}
        <p style="color:#8B949E;font-size:13px;margin-top:24px;">Show up curious. That's all they ask.</p>
      </div>
    `,
  }).catch(err => logSwallowed('email.accept_failed', err, { requestId: request.id }));
}
