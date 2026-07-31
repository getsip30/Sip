import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWithRetry(payload: Parameters<typeof resend.emails.send>[0], attempt = 1): Promise<unknown> {
  try {
    const result = await resend.emails.send(payload);
    if (result.error) throw new Error(result.error.message);
    return result;
  } catch (err) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, attempt * 1000));
      return sendWithRetry(payload, attempt + 1);
    }
    console.error('Email send failed after 3 attempts:', err);
    throw err;
  }
}

export const transporter = {
  sendMail: async ({ to, subject, html, text }: { from?: string; to: string; subject: string; html?: string; text?: string }) => {
    return sendWithRetry({
      from: 'Sip <hello@getsip.co>',
      to,
      subject,
      html: html ?? `<pre>${text}</pre>`,
      text,
    } as Parameters<typeof resend.emails.send>[0]);
  },
};