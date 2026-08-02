import { escapeHtml } from '@/lib/utils';

/**
 * Shared shell for Sip transactional email.
 *
 * Table-based and inline-styled on purpose: email clients strip <style> blocks
 * and have no grid or flex worth relying on. The palette matches the app and
 * the mail it already sends, which is the point of routing these through here
 * rather than accepting a provider's stock template.
 */
const BG = '#070A10';
const CARD = '#0D1117';
const TEXT = '#E6EDF3';
const MUTED = '#8B949E';
const ACCENT = '#70B5F9';
const BORDER = 'rgba(255,255,255,0.08)';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://getsip.co';

export function emailShell({
  preheader,
  heading,
  body,
  footerNote,
}: {
  /** Inbox preview text. Hidden in the body but read by most clients. */
  preheader: string;
  heading: string;
  body: string;
  footerNote?: string;
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${CARD};border:1px solid ${BORDER};border-radius:16px;">
          <tr>
            <td style="padding:36px 40px 0;">
              <img src="${APP_URL}/logo.png" width="44" height="44" alt="Sip"
                   style="display:block;border:0;outline:none;text-decoration:none;">
            </td>
          </tr>
          <tr>
            <td style="padding:22px 40px 0;">
              <h1 style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;line-height:1.35;font-weight:700;color:${TEXT};letter-spacing:-0.2px;">
                ${heading}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 40px 36px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#C9D1D9;">
              ${body}
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td style="padding:18px 40px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};">
              ${footerNote ? `${footerNote}<br><br>` : ''}
              <a href="${APP_URL}" style="color:${ACCENT};text-decoration:none;">getsip.co</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * The one-time code Clerk would otherwise send from its stock template.
 *
 * The code is the whole message, so it is the only thing set at display size,
 * in a monospace face, and spaced out enough to read a character at a time.
 * There is no link and no button: nothing here should train someone to click
 * their way through a login email.
 */
export function verificationCodeEmail({ code, purpose }: { code: string; purpose: 'verify' | 'reset' }) {
  const heading = purpose === 'reset' ? 'Reset your password' : 'Your sign-in code';
  const lead = purpose === 'reset'
    ? 'Use this code to set a new password.'
    : 'Use this code to finish signing in.';

  const body = `
    <p style="margin:0 0 22px;">${lead}</p>
    <div style="background:#070A10;border:1px solid ${BORDER};border-radius:12px;padding:22px 20px;text-align:center;">
      <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:9px;color:${TEXT};">
        ${escapeHtml(code)}
      </div>
    </div>
    <p style="margin:22px 0 0;color:${MUTED};font-size:13px;">
      It expires shortly. If you did not ask for it, you can ignore this email and nothing will change.
    </p>`;

  return {
    subject: `${code} is your Sip code`,
    html: emailShell({
      preheader: `${code} is your Sip code`,
      heading,
      body,
      footerNote: 'Sip will never ask you for this code.',
    }),
    text: `${heading}\n\n${lead}\n\n${code}\n\nIt expires shortly. If you did not ask for it, ignore this email.\n\n${APP_URL}`,
  };
}
