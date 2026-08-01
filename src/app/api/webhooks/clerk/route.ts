import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/db';
import { mentors, seekers, requests, asks, follows, queueEntries, referralEvents, flags, consents, siteFeedback, sipFeedback, sipNotes } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

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
  } catch {
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

      await db.delete(requests).where(eq(requests.seekerClerkId, id));
      await db.delete(asks).where(eq(asks.seekerClerkId, id));
      await db.delete(follows).where(eq(follows.seekerClerkId, id));
      await db.delete(queueEntries).where(eq(queueEntries.seekerClerkId, id));
      await db.delete(referralEvents).where(or(eq(referralEvents.referrerClerkId, id), eq(referralEvents.referredClerkId, id)));
      await db.delete(consents).where(eq(consents.clerkId, id));
      await db.delete(siteFeedback).where(eq(siteFeedback.clerkId, id));
      await db.delete(sipFeedback).where(eq(sipFeedback.raterClerkId, id));
      // Both sides of a flag: reports they filed and reports filed about them.
      await db.delete(flags).where(or(eq(flags.reporterClerkId, id), eq(flags.reportedClerkId, id)));

      // Requests/notes created while logged out are keyed only by email.
      for (const email of emails) {
        await db.delete(requests).where(eq(requests.seekerEmail, email));
        await db.delete(sipNotes).where(eq(sipNotes.seekerEmail, email));
      }

      await db.delete(mentors).where(eq(mentors.clerkId, id));
      await db.delete(seekers).where(eq(seekers.clerkId, id));
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