import { db } from '@/db';
import {
  mentors, seekers, rooms, requests, asks, follows, queueEntries, referralEvents,
  flags, consents, siteFeedback, sipFeedback, sipNotes, takeaways, sessionNotes,
  sessionFeedback, noShowReports,
} from '@/db/schema';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { logInfo } from '@/lib/logger';

/**
 * Self-service account deletion.
 *
 * The account row is SCRUBBED IN PLACE, not deleted. Nine tables cascade off
 * `mentors.id` — rooms, requests, asks, sip_notes, badges, follows, sip_feedback,
 * session_feedback, session_notes — so removing the row would take a seeker's
 * booking history, the testimonials they wrote and the public Q&A down with it.
 * Deletion is supposed to erase one person, not rewrite everyone else's.
 *
 * Two moves do the work:
 *
 * 1. Every occurrence of the real Clerk id is replaced with a single per-account
 *    TOMBSTONE id. That strips the identifier while preserving row shape — which
 *    matters, because `takeaways` has three partial unique indexes keyed on
 *    clerk ids and nulling those columns would collapse distinct rows into
 *    conflicting ones.
 *
 * 2. Every human-readable copy of their name or email — denormalised into
 *    requests, sip_notes, session_notes, takeaways and flags — is overwritten
 *    with a placeholder.
 *
 * Scrubbing `mentors.clerk_id` / `seekers.clerk_id` is also what switches the
 * account off. Every authenticated path resolves the caller by clerk id
 * (`requireMentor`, `requireSeeker`, `hasRoleRow`), so once the tombstone lands
 * none of them find a row and the user is treated as brand new. `deletedAt` is
 * only needed by the handful of PUBLIC lookups that go by `mentors.id`.
 *
 * IDEMPOTENT by construction: after the first pass no row anywhere holds the
 * real clerk id, so a second pass matches nothing and updates nothing. That is
 * load-bearing — deleting the Clerk user fires a `user.deleted` webhook that
 * calls straight back into here.
 */

/** Shown wherever a deleted person's name used to be. */
export const DELETED_NAME = 'Former member';
const DELETED_FIRST = 'Former';
const DELETED_LAST = 'member';

/** Non-routable, so a stray send can never reach a real inbox. */
const DELETED_EMAIL_DOMAIN = 'deleted.invalid';

/**
 * `mentors.email` is UNIQUE and NOT NULL and `mentors.referral_code` is UNIQUE,
 * so the placeholders have to be per-account rather than a shared constant, or
 * the second deletion on the instance would fail on a duplicate key.
 */
function tombstoneFor(): { id: string; email: string } {
  const token = crypto.randomUUID();
  return { id: `deleted_${token}`, email: `deleted-${token}@${DELETED_EMAIL_DOMAIN}` };
}

export type AnonymizeResult = {
  /** True when an account row was actually found and scrubbed. */
  anonymized: boolean;
  hadMentor: boolean;
  hadSeeker: boolean;
};

export async function anonymizeAccount(clerkId: string): Promise<AnonymizeResult> {
  const now = new Date();
  const tombstone = tombstoneFor();

  // Read the account rows BEFORE anything is scrubbed: the email-keyed cleanup
  // below (requests and sip_notes made while logged out) has no other way to
  // find its rows once the address is gone.
  const [mentorRows, seekerRows] = await Promise.all([
    db.select({ id: mentors.id, email: mentors.email }).from(mentors).where(eq(mentors.clerkId, clerkId)),
    db.select({ id: seekers.id, email: seekers.email }).from(seekers).where(eq(seekers.clerkId, clerkId)),
  ]);
  const mentorRow = mentorRows[0];
  const seekerRow = seekerRows[0];
  const emails = [mentorRow?.email, seekerRow?.email].filter(Boolean) as string[];

  // ---------------------------------------------------------------------
  // 1. Rows that are purely this person's own, readable by nobody else, and
  //    unreachable once the account is gone. These are deleted outright.
  //
  //    `takeaways` is the deliberate asymmetry: a takeaway THEY wrote goes,
  //    because it is private to its author and no route reads another person's
  //    rows. A takeaway ABOUT them, or one their counterpart wrote about a
  //    shared session, is somebody else's note and is kept (scrubbed) below.
  // ---------------------------------------------------------------------
  await Promise.all([
    db.delete(takeaways).where(eq(takeaways.authorClerkId, clerkId)),
    db.delete(follows).where(eq(follows.seekerClerkId, clerkId)),
    db.delete(queueEntries).where(eq(queueEntries.seekerClerkId, clerkId)),
    db.delete(consents).where(eq(consents.clerkId, clerkId)),
  ]);

  // ---------------------------------------------------------------------
  // 2. Takeaways whose `sessionLabel` is the departing person's name.
  //
  //    The label is denormalised free text, written at save time so the note
  //    still reads correctly after its parent row goes away. For a 1:1 it is the
  //    COUNTERPART's name, which means the other side's takeaway is carrying
  //    this person's name and has to be scrubbed. Room takeaways label the room
  //    title, not a person, so they are left alone.
  //
  //    Runs before the request scrub below, while `requests.seekerClerkId` still
  //    identifies which requests were theirs.
  // ---------------------------------------------------------------------
  const labelScrubs = [];
  if (mentorRow) {
    // The seeker's own takeaway from a 1:1 with this mentor.
    labelScrubs.push(
      db.update(takeaways).set({ sessionLabel: DELETED_NAME, updatedAt: now }).where(
        and(
          eq(takeaways.authorRole, 'seeker'),
          inArray(
            takeaways.requestId,
            db.select({ id: requests.id }).from(requests).where(eq(requests.mentorId, mentorRow.id))
          )
        )
      )
    );
  }
  // The mentor's own takeaway from a 1:1 with this seeker.
  labelScrubs.push(
    db.update(takeaways).set({ sessionLabel: DELETED_NAME, updatedAt: now }).where(
      and(
        eq(takeaways.authorRole, 'mentor'),
        inArray(
          takeaways.requestId,
          db.select({ id: requests.id }).from(requests).where(eq(requests.seekerClerkId, clerkId))
        )
      )
    )
  );
  await Promise.all(labelScrubs);

  // ---------------------------------------------------------------------
  // 3. Rows other people depend on. Tombstone the clerk id, overwrite the
  //    readable name/email, keep the row so the counterpart's history survives.
  // ---------------------------------------------------------------------
  await Promise.all([
    // Bookings they made. The mentor keeps the session record; the seeker's
    // identity comes out of it.
    db.update(requests)
      .set({ seekerClerkId: tombstone.id, seekerName: DELETED_NAME, seekerEmail: tombstone.email, seekerLinkedin: null })
      .where(eq(requests.seekerClerkId, clerkId)),

    db.update(asks)
      .set({ seekerClerkId: tombstone.id, seekerName: DELETED_NAME, seekerEmail: tombstone.email })
      .where(eq(asks.seekerClerkId, clerkId)),

    // A mentor's per-person takeaway ABOUT this seeker. The subject id keeps a
    // tombstone rather than NULL: `takeaways_author_room_subject_idx` is a
    // partial unique index predicated on that column being NOT NULL, and nulling
    // it would push the row into the group-takeaway index and collide there.
    db.update(takeaways)
      .set({ subjectSeekerClerkId: tombstone.id, subjectName: DELETED_NAME, updatedAt: now })
      .where(eq(takeaways.subjectSeekerClerkId, clerkId)),

    // A mentor's private notes about this seeker. Kept — they are the mentor's
    // own record of a session they ran — with the seeker's identity removed.
    db.update(sessionNotes)
      .set({ seekerClerkId: tombstone.id, seekerName: DELETED_NAME })
      .where(eq(sessionNotes.seekerClerkId, clerkId)),

    db.update(sessionFeedback).set({ seekerClerkId: tombstone.id }).where(eq(sessionFeedback.seekerClerkId, clerkId)),
    db.update(sessionFeedback).set({ raterClerkId: tombstone.id }).where(eq(sessionFeedback.raterClerkId, clerkId)),
    db.update(sipFeedback).set({ raterClerkId: tombstone.id }).where(eq(sipFeedback.raterClerkId, clerkId)),

    // Moderation history is retained on purpose — a departing account should not
    // erase reports filed about it — but de-identified.
    db.update(flags).set({ reporterClerkId: tombstone.id }).where(eq(flags.reporterClerkId, clerkId)),
    db.update(flags).set({ reportedClerkId: tombstone.id, reportedName: DELETED_NAME }).where(eq(flags.reportedClerkId, clerkId)),
    db.update(noShowReports).set({ reportedByClerkId: tombstone.id }).where(eq(noShowReports.reportedByClerkId, clerkId)),
    db.update(noShowReports).set({ reportedClerkId: tombstone.id }).where(eq(noShowReports.reportedClerkId, clerkId)),

    // The referral ledger stays intact so whoever invited them keeps the credit.
    db.update(referralEvents).set({ referrerClerkId: tombstone.id }).where(eq(referralEvents.referrerClerkId, clerkId)),
    db.update(referralEvents).set({ referredClerkId: tombstone.id }).where(eq(referralEvents.referredClerkId, clerkId)),

    // Product feedback is worth keeping; the author is not part of what makes it
    // useful, and the column is nullable.
    db.update(siteFeedback).set({ clerkId: null }).where(eq(siteFeedback.clerkId, clerkId)),

    // Dangling "invited by" pointers on everyone they referred.
    db.update(mentors).set({ invitedByClerkId: null }).where(eq(mentors.invitedByClerkId, clerkId)),
    db.update(seekers).set({ invitedByClerkId: null }).where(eq(seekers.invitedByClerkId, clerkId)),
  ]);

  // ---------------------------------------------------------------------
  // 4. Rows keyed only by email — a request or a testimonial left while logged
  //    out, which carries no clerk id at all.
  // ---------------------------------------------------------------------
  if (emails.length > 0) {
    await Promise.all([
      db.update(requests)
        .set({ seekerName: DELETED_NAME, seekerEmail: tombstone.email, seekerLinkedin: null })
        .where(and(inArray(requests.seekerEmail, emails), isNull(requests.seekerClerkId))),
      db.update(sipNotes)
        .set({ seekerName: DELETED_NAME, seekerEmail: null })
        .where(inArray(sipNotes.seekerEmail, emails)),
    ]);
  }

  // ---------------------------------------------------------------------
  // 5. Leave nothing of theirs still running.
  //
  //    A live or scheduled room and a pending request both promise a person who
  //    is no longer there. Ending and cancelling them is what stops a seeker
  //    waiting on a reply that can never come.
  // ---------------------------------------------------------------------
  if (mentorRow) {
    await Promise.all([
      db.update(rooms).set({ status: 'ended', endedAt: now })
        .where(and(eq(rooms.mentorId, mentorRow.id), ne(rooms.status, 'ended'))),
      db.update(requests).set({ status: 'cancelled', cancelledAt: now, cancelledBy: 'mentor' })
        .where(and(eq(requests.mentorId, mentorRow.id), inArray(requests.status, ['pending', 'accepted']))),
    ]);
  }
  if (seekerRow) {
    // Their outstanding asks to mentors, now tombstoned above, and any booking
    // still waiting on a mentor's time.
    await db.update(requests).set({ status: 'cancelled', cancelledAt: now, cancelledBy: 'seeker' })
      .where(and(eq(requests.seekerClerkId, tombstone.id), inArray(requests.status, ['pending', 'accepted'])));
  }

  // ---------------------------------------------------------------------
  // 6. The account rows themselves. LAST, because every step above locates its
  //    rows through the real clerk id or the real email.
  // ---------------------------------------------------------------------
  if (mentorRow) {
    await db.update(mentors).set({
      clerkId: tombstone.id,
      deletedAt: now,
      firstName: DELETED_FIRST,
      lastName: DELETED_LAST,
      email: tombstone.email,
      role: '', company: '', bio: '', topics: '', availability: '',
      calendarLink: null, googleCalendarLink: null, contactEmail: null,
      linkedin: null, showLinkedin: false,
      avatarData: null, defaultNote: null,
      // Freed rather than kept: a dead code should not keep claiming the
      // namespace, and any link already sent now falls through to no referrer.
      referralCode: null,
      invitedByClerkId: null,
      // Belt and braces. Every listing filters `deletedAt`, but these two are
      // what the older "is this mentor available" checks read.
      isOpen: false,
      autoAccept: false,
    }).where(eq(mentors.id, mentorRow.id));
  }
  if (seekerRow) {
    await db.update(seekers).set({
      clerkId: tombstone.id,
      deletedAt: now,
      firstName: DELETED_FIRST,
      lastName: DELETED_LAST,
      email: tombstone.email,
      age: null,
      linkedin: null,
      interests: '',
      avatarData: null,
      referralCode: null,
      invitedByClerkId: null,
    }).where(eq(seekers.id, seekerRow.id));
  }

  const result = { anonymized: Boolean(mentorRow || seekerRow), hadMentor: Boolean(mentorRow), hadSeeker: Boolean(seekerRow) };
  logInfo('account.anonymized', { ...result, tombstoneId: tombstone.id });
  return result;
}
