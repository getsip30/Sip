import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/db';
import { mentors, seekers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { anonymizeAccount } from '@/lib/account-deletion';
import { logInfo, logWarn } from '@/lib/logger';
import { transporter } from '@/lib/mailer';
import { verificationCodeEmail } from '@/lib/email-template';

/**
 * Clerk email templates Sip would render and send itself. Anything not listed
 * stays with Clerk.
 *
 * Both of these are currently unreachable. See the email.created branch below:
 * Clerk will not hand over delivery of either one, so nothing in this list can
 * fire today.
 */
const SELF_SENT_EMAIL_SLUGS = ['verification_code', 'reset_password_code'];

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) return new Response('No webhook secret', { status: 400 });

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    // A burst of these means either a misconfigured secret or someone probing
    // the endpoint, and both are things worth seeing.
    logWarn('webhook.signature_invalid', { svixId: svix_id, message: String(err) });
    return new Response('Invalid webhook', { status: 400 });
  }

  // Clerk emails we render and send ourselves.
  //
  // DORMANT, and not because a switch is waiting to be flipped. Clerk refuses to
  // hand over delivery of any template that carries a credential: on this
  // instance verification_code, reset_password_code, the magic_link templates
  // and invitation all report can_toggle:false, while notification templates
  // like password_changed and new_device_sign_in report true. Same instance,
  // same plan, so this is policy rather than billing. The reasoning is sound
  // enough: if this endpoint were down, nobody could sign in.
  //
  // So this branch only starts running if Clerk un-gates the instance, which
  // means a support request rather than a dashboard setting. Separately,
  // editing the template's own body is gated on the app:custom_email_template
  // plan feature, so neither route to a branded code email is open right now.
  //
  // The guard below is still the thing that makes this safe: while Clerk
  // delivers, delivered_by_clerk is true and we return without sending, so two
  // codes can never land in one inbox. If delivery is ever granted, this works
  // as written with no changes.
  if (evt.type === 'email.created') {
    const email = evt.data;
    const slug = email.slug ?? '';
    const to = email.to_email_address;

    if (email.delivered_by_clerk || !to || !SELF_SENT_EMAIL_SLUGS.includes(slug)) {
      return new Response('OK', { status: 200 });
    }

    // Clerk names this otp_code; fall back rather than send an email with a
    // blank code in it if that ever changes.
    const data = (email.data ?? {}) as Record<string, unknown>;
    const code = String(data.otp_code ?? data.code ?? '').trim();
    if (!code) {
      logWarn('webhook.email_missing_code', { slug, emailId: email.id });
      return new Response('OK', { status: 200 });
    }

    const built = verificationCodeEmail({
      code,
      purpose: slug === 'reset_password_code' ? 'reset' : 'verify',
    });

    try {
      await transporter.sendMail({ to, subject: built.subject, html: built.html, text: built.text });
      logInfo('webhook.email_sent', { slug, emailId: email.id });
    } catch (err) {
      // A 500 asks Clerk to retry, which is what we want: a code that never
      // arrives locks someone out of signing in.
      logWarn('webhook.email_send_failed', { slug, emailId: email.id, message: String(err) });
      return new Response('Email send failed', { status: 500 });
    }

    return new Response('OK', { status: 200 });
  }

  if (evt.type === 'user.deleted') {
    const { id } = evt.data;
    if (id) {
      // This used to hard-delete the account rows, which cascaded through nine
      // tables hanging off `mentors.id` and took other people's history with it:
      // a seeker's bookings, the testimonials they had written, the public Q&A.
      // It had also drifted out of date — takeaways, session_notes,
      // session_feedback and no_show_reports were all added afterwards and were
      // never cleaned up here, so those rows outlived the account with the
      // person's name and Clerk id still in them.
      //
      // Both problems are now handled in one place. `anonymizeAccount` scrubs
      // rather than deletes, covers every table, and is idempotent — so it does
      // not matter whether this webhook or DELETE /api/account got here first.
      const result = await anonymizeAccount(id);
      logInfo('webhook.user_deleted', { clerkId: id, ...result });
    }
  }

  if (evt.type === 'user.updated') {
    const { id, email_addresses } = evt.data;
    const email = email_addresses?.[0]?.email_address;
    if (id && email) {
      await db.update(mentors).set({ email }).where(eq(mentors.clerkId, id));
      await db.update(seekers).set({ email }).where(eq(seekers.clerkId, id));
    }
  }

  return new Response('OK', { status: 200 });
}