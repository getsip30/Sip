import { Resend } from 'resend';
import { withTimeout, withRetry } from '@/lib/external';
import { logSwallowed } from '@/lib/logger';

const resend = new Resend(process.env.RESEND_API_KEY);

const SEND_TIMEOUT_MS = 10000;
type SendPayload = Parameters<typeof resend.emails.send>[0];

async function send(payload: SendPayload) {
  const result = await withTimeout('resend', SEND_TIMEOUT_MS, resend.emails.send(payload));
  if (result.error) throw new Error(result.error.message);
  return result;
}

export const transporter = {
  sendMail: async ({ to, subject, html, text }: { from?: string; to: string; subject: string; html?: string; text?: string }) => {
    const payload = {
      from: 'Sip <hello@getsip.co>',
      to,
      subject,
      html: html ?? `<pre>${text}</pre>`,
      text,
    } as SendPayload;

    return withRetry('resend', () => send(payload), { attempts: 3, baseDelayMs: 400 });
  },
};

/**
 * Send without letting a mail failure fail the request. Every caller that
 * previously used a bare `.catch(console.error)` should use this so the failure
 * still reaches Sentry instead of disappearing into stdout.
 */
export async function sendMailBestEffort(
  event: string,
  args: { to: string; subject: string; html?: string; text?: string },
  fields: Record<string, unknown> = {}
) {
  try {
    await transporter.sendMail(args);
  } catch (err) {
    logSwallowed(event, err, { ...fields, to: args.to });
  }
}
