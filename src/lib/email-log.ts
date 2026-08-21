import { db } from '@/db';
import { emailLogs } from '@/db/schema';
import { transporter } from '@/lib/mailer';
import { logSwallowed } from '@/lib/logger';

/**
 * Kinds of mail Sip sends.
 *
 * Only `manual_broadcast` is written today — it is the one send site wired into
 * `sendAndLog`. The rest of the list names the mail the app already sends from
 * ~17 other places without logging, so that migrating one of them later is a
 * matter of swapping the call, not widening this type and backfilling meaning
 * into rows that were written under a different vocabulary.
 */
export const EMAIL_TYPES = [
  'manual_broadcast',
  'sip_requested',
  'sip_confirmation',
  'sip_declined',
  'sip_cancelled',
  'sip_reminder',
  'sip_nudge',
  'ask_received',
  'ask_answered',
  'mentor_match',
  'room_live',
  'room_scheduled',
  'checkin',
  'flag_alert',
  'verification_code',
] as const;

export type EmailType = typeof EMAIL_TYPES[number];
export type EmailAudience = 'all_seekers' | 'all_mentors' | 'everyone' | 'specific';

export type LoggedRecipient = {
  email: string;
  clerkId?: string | null;
  role?: 'mentor' | 'seeker' | null;
};

/**
 * Send one email and record the attempt, successful or not.
 *
 * The log write is deliberately outside the send's failure path: a failed send
 * produces a row with status 'failed' and the reason, because a broadcast that
 * reports "1 failed" and leaves nothing to inspect is not worth reporting at
 * all. Only a failure to write the log itself is swallowed, since at that point
 * there is nothing left to record it with.
 *
 * Returns whether the send succeeded, so callers can total up.
 */
export async function sendAndLog({
  recipient,
  subject,
  html,
  text,
  emailType,
  audience = null,
}: {
  recipient: LoggedRecipient;
  subject: string;
  html?: string;
  text?: string;
  emailType: EmailType;
  audience?: EmailAudience | null;
}): Promise<boolean> {
  let resendId: string | null = null;
  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;

  try {
    const result = await transporter.sendMail({ to: recipient.email, subject, html, text });
    // Resend's own id, kept so a delivery question can be traced in their
    // dashboard rather than guessed at from a timestamp.
    resendId = (result as { data?: { id?: string } | null })?.data?.id ?? null;
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  try {
    await db.insert(emailLogs).values({
      resendId,
      recipientEmail: recipient.email,
      recipientClerkId: recipient.clerkId ?? null,
      recipientRole: recipient.role ?? null,
      audience,
      emailType,
      subject,
      status,
      errorMessage,
    });
  } catch (err) {
    logSwallowed('email_log.insert_failed', err, { to: recipient.email, emailType });
  }

  return status === 'sent';
}
