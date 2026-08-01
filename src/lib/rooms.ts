import { db } from '@/db';
import { follows, mentors, rooms } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { getClerkEmails } from '@/lib/clerk';
import { sendMailBestEffort } from '@/lib/mailer';
import { escapeHtml } from '@/lib/utils';
import { logSwallowed } from '@/lib/logger';

type Room = typeof rooms.$inferSelect;
type Mentor = typeof mentors.$inferSelect;

/** Caps one fan-out so a mentor with a huge following can't stall a background task. */
const FOLLOWER_FANOUT_LIMIT = 500;
const MAIL_CONCURRENCY = 5;

function roomLink(roomId: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/rooms/${roomId}`;
}

/**
 * Email the mentor's followers that they are live. Safe to call from `after()`.
 * Every failure is contained so one bad address can't abort the rest.
 */
export async function notifyFollowersLive(mentor: Mentor, roomId: string) {
  const followers = await db.select({ seekerClerkId: follows.seekerClerkId }).from(follows)
    .where(eq(follows.mentorId, mentor.id))
    .limit(FOLLOWER_FANOUT_LIMIT);
  if (followers.length === 0) return;

  // Resolve every address up front with bounded concurrency instead of one
  // serial round trip per follower.
  const emails = await getClerkEmails(followers.map((f) => f.seekerClerkId));
  if (emails.size === 0) return;

  const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">${escapeHtml(mentor.firstName)} ${escapeHtml(mentor.lastName)} just went live</h2><p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">Jump in now before the session ends.</p><a href="${roomLink(roomId)}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Join now →</a></div>`;
  const subject = `${mentor.firstName} is live on Sip right now`;

  const addresses = [...emails.values()];
  for (let i = 0; i < addresses.length; i += MAIL_CONCURRENCY) {
    await Promise.all(
      addresses.slice(i, i + MAIL_CONCURRENCY).map((to) =>
        sendMailBestEffort('rooms.follower_notify_failed', { to, subject, html }, { mentorId: mentor.id, roomId })
      )
    );
  }
}

/**
 * Flip one scheduled room live. Returns the room if THIS call performed the
 * flip, else null.
 *
 * The UPDATE is conditional on status='scheduled', so concurrent callers race on
 * a single row and only the winner gets rows back. That is what makes it safe to
 * trigger from a GET without sending duplicate mail — pair it with
 * notifyRoomLive() in `after()`.
 *
 * `onlyIfDue` guards the automatic paths (cron, lazy flip on view); the mentor's
 * explicit "go live now" passes false so they can start ahead of schedule.
 */
export async function flipToLive(roomId: string, onlyIfDue = true): Promise<Room | null> {
  const conditions = [eq(rooms.id, roomId), eq(rooms.status, 'scheduled')];
  if (onlyIfDue) conditions.push(lte(rooms.scheduledAt, new Date()));

  const flipped = await db.update(rooms)
    .set({ status: 'live', startedAt: new Date() })
    .where(and(...conditions))
    .returning();

  return flipped[0] ?? null;
}

/** Mentor + follower "you're live" mail for a room that just flipped. */
export async function notifyRoomLive(room: Room) {
  try {
    const mentor = (await db.select().from(mentors).where(eq(mentors.id, room.mentorId)))[0];
    if (!mentor) return;

    await sendMailBestEffort(
      'rooms.mentor_go_live_notify_failed',
      {
        to: mentor.email,
        subject: `You're live on Sip`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;">Your scheduled sip just started</h2><p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">Seekers can now line up. Jump into your room:</p><a href="${roomLink(room.id)}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Go to your room →</a></div>`,
      },
      { roomId: room.id }
    );

    await notifyFollowersLive(mentor, room.id);
  } catch (err) {
    logSwallowed('rooms.go_live_notifications_failed', err, { roomId: room.id });
  }
}
