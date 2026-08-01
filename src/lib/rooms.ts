import { db } from '@/db';
import { follows, mentors, rooms } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { clerkClient } from '@clerk/nextjs/server';
import { transporter } from '@/lib/mailer';
import { escapeHtml } from '@/lib/utils';

type Room = typeof rooms.$inferSelect;
type Mentor = typeof mentors.$inferSelect;

function roomLink(roomId: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/rooms/${roomId}`;
}

/**
 * Email the mentor's followers that they are live. Safe to call from `after()`.
 * Every failure is contained so one bad address can't abort the rest.
 */
export async function notifyFollowersLive(mentor: Mentor, roomId: string) {
  const followers = await db.select().from(follows).where(eq(follows.mentorId, mentor.id));
  if (followers.length === 0) return;

  const client = await clerkClient();
  for (const f of followers) {
    try {
      const followerUser = await client.users.getUser(f.seekerClerkId);
      const email = followerUser.emailAddresses[0]?.emailAddress;
      if (!email) continue;
      await transporter.sendMail({
        to: email,
        subject: `${mentor.firstName} is live on Sip right now`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;color:#E6EDF3;">${escapeHtml(mentor.firstName)} ${escapeHtml(mentor.lastName)} just went live</h2><p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">Jump in now before the session ends.</p><a href="${roomLink(roomId)}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Join now →</a></div>`,
      });
    } catch (e) {
      console.error('follower notify failed:', e);
    }
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

    try {
      await transporter.sendMail({
        to: mentor.email,
        subject: `You're live on Sip`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0D1117;color:#E6EDF3;padding:40px;border-radius:16px;"><div style="font-size:28px;font-weight:700;color:#70B5F9;margin-bottom:8px;">sip</div><h2 style="font-size:22px;margin-bottom:16px;">Your scheduled sip just started</h2><p style="color:#8B949E;font-size:14px;line-height:1.7;margin-bottom:24px;">Seekers can now line up. Jump into your room:</p><a href="${roomLink(room.id)}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Go to your room →</a></div>`,
      });
    } catch (e) {
      console.error(`go-live mentor notify failed for room ${room.id}:`, e);
    }

    await notifyFollowersLive(mentor, room.id);
  } catch (e) {
    console.error(`go-live notifications failed for room ${room.id}:`, e);
  }
}
