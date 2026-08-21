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
import { logEvent } from '@/lib/events';

/**
 * Clerk email templates Sip would render and send itself. Anything not listed
 * stays with Clerk.
 *
 * Both of these are currently unreachable. See the email.created branch below:
 * Clerk will not hand over delivery of either one, so nothing in this list can
 * fire today.
 */
const SELF_SENT_EMAIL_SLUGS = ['verification_code', 'reset_password_code'];

/**
 * Whether a thrown error is specifically the mentors-email unique violation.
 * Drizzle wraps the driver error, so the fields live down the `cause` chain.
 *
 * A copy of isEmailTaken in POST /api/mentor. Worth extracting to a shared
 * module the next time a third caller needs it; kept local here so this fix
 * touches one file.
 */
function isMentorEmailTaken(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current != null && depth < 4; depth++) {
    const pg = current as { code?: unknown; constraint?: unknown };
    if (String(pg?.code) === '23505' && String(pg?.constraint) === 'mentors_email_unique') return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

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

  /**
   * Signup completion, for the admin dashboard's funnel.
   *
   * The webhook rather than any page in the app, because "finished signing up"
   * is a Clerk fact and this is the only place Sip is told it. /choose-role is
   * the first screen after signup, but it is also reachable any time afterwards,
   * so logging there would count returning visits as signups.
   *
   * Requires `user.created` to be subscribed on the Clerk webhook endpoint. If
   * it is not, nothing breaks — this step of the funnel just stays at zero.
   *
   * No role yet: the account exists but has onboarded into nothing, which is
   * exactly what distinguishes this step from profile_setup_complete.
   */
  if (evt.type === 'user.created') {
    await logEvent('signup_complete', { clerkId: evt.data.id });
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
    const { id, email_addresses, primary_email_address_id } = evt.data;

    // The address Clerk marks primary, not whichever happens to sit at index 0.
    // POST /api/mentor was changed to do this because the value lands in
    // mentors.email, which is UNIQUE — but this handler writes the same column,
    // so leaving it on index 0 meant every user.updated event could overwrite
    // that choice with an arbitrary one and undo the fix. Falls back to index 0
    // when no primary is set, matching the signup path rather than dropping the
    // update entirely.
    const email =
      email_addresses?.find(e => e.id === primary_email_address_id)?.email_address
      ?? email_addresses?.[0]?.email_address;

    if (id && email) {
      // mentors.email is UNIQUE, and a webhook has nobody to hand a 409 to. An
      // address that already belongs to a DIFFERENT account cannot be written
      // here no matter how many times it is attempted, so throwing would turn a
      // permanent conflict into a 500 that Clerk retries on a schedule forever.
      // Skipping and recording it leaves the existing row untouched, which is
      // the same call the signup path makes: it refuses to move a profile
      // between accounts on the strength of an unverified address.
      //
      // Own-row matches are not conflicts — a mentor whose row already holds
      // this address is the normal case, and the update is then a no-op.
      const holders = await db
        .select({ clerkId: mentors.clerkId })
        .from(mentors)
        .where(eq(mentors.email, email));

      if (holders.some(m => m.clerkId !== id)) {
        // No email in the log line: the point is which account was skipped, and
        // the address is the other party's PII.
        logWarn('webhook.user_updated_email_conflict', { clerkId: id });
      } else {
        try {
          await db.update(mentors).set({ email }).where(eq(mentors.clerkId, id));
        } catch (err) {
          // The check above is a read and a write with nothing holding them
          // together, so a concurrent signup on the same address can still win
          // the race. Narrowed to that one constraint — a clerk_id or
          // referral_code conflict is a different problem and must still fail
          // loudly so Clerk retries it. Mirrors isEmailTaken in
          // POST /api/mentor; duplicated rather than shared to keep this change
          // to one file.
          if (!isMentorEmailTaken(err)) throw err;
          logWarn('webhook.user_updated_email_conflict_race', { clerkId: id });
        }
      }

      // seekers.email carries no unique constraint, so it has no conflict to
      // lose and is always safe to write.
      await db.update(seekers).set({ email }).where(eq(seekers.clerkId, id));
    }
  }

  return new Response('OK', { status: 200 });
}