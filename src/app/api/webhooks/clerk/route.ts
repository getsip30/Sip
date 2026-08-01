import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/db';
import { mentors, seekers, requests, asks, follows, queueEntries, referralEvents, flags, consents, siteFeedback, sipFeedback, sipNotes } from '@/db/schema';
import { eq, or, inArray } from 'drizzle-orm';
import { logInfo, logWarn } from '@/lib/logger';

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

  if (evt.type === 'user.deleted') {
    const { id } = evt.data;
    if (id) {
      // Rows owned by a mentor row cascade via FK. Everything below stores the
      // Clerk id (or email) as loose text with no FK, so it has to be cleaned up
      // by hand or it outlives the account.
      const [mentorRow, seekerRow] = await Promise.all([
        db.select({ id: mentors.id, email: mentors.email }).from(mentors).where(eq(mentors.clerkId, id)),
        db.select({ id: seekers.id, email: seekers.email }).from(seekers).where(eq(seekers.clerkId, id)),
      ]);
      const emails = [mentorRow[0]?.email, seekerRow[0]?.email].filter(Boolean) as string[];

      // These target independent tables, so they run concurrently rather than as
      // a dozen sequential round trips.
      await Promise.all([
        db.delete(requests).where(eq(requests.seekerClerkId, id)),
        db.delete(asks).where(eq(asks.seekerClerkId, id)),
        db.delete(follows).where(eq(follows.seekerClerkId, id)),
        db.delete(queueEntries).where(eq(queueEntries.seekerClerkId, id)),
        db.delete(referralEvents).where(or(eq(referralEvents.referrerClerkId, id), eq(referralEvents.referredClerkId, id))),
        db.delete(consents).where(eq(consents.clerkId, id)),
        db.delete(siteFeedback).where(eq(siteFeedback.clerkId, id)),
        db.delete(sipFeedback).where(eq(sipFeedback.raterClerkId, id)),
        // Both sides of a flag: reports they filed and reports filed about them.
        db.delete(flags).where(or(eq(flags.reporterClerkId, id), eq(flags.reportedClerkId, id))),
      ]);

      // Requests/notes created while logged out are keyed only by email.
      if (emails.length > 0) {
        await Promise.all([
          db.delete(requests).where(inArray(requests.seekerEmail, emails)),
          db.delete(sipNotes).where(inArray(sipNotes.seekerEmail, emails)),
        ]);
      }

      // Last, so the cascade can't remove rows the cleanup above still needs.
      await Promise.all([
        db.delete(mentors).where(eq(mentors.clerkId, id)),
        db.delete(seekers).where(eq(seekers.clerkId, id)),
      ]);
      logInfo('webhook.user_deleted', { clerkId: id });
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