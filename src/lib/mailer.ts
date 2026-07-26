import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const transporter = {
  sendMail: async ({ to, subject, html, text }: { from?: string; to: string; subject: string; html?: string; text?: string }) => {
    return resend.emails.send({
      from: 'Sip <hello@getsip.co>',
      to,
      subject,
      html: html ?? `<pre>${text}</pre>`,
      text,
    } as Parameters<typeof resend.emails.send>[0]);
  },
};