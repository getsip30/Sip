/**
 * Rules for Takeaways — the private, per-person notes each side can write about
 * a session they were in.
 *
 * Pure and free of database and Clerk imports, for the same reason @/lib/no-show
 * is: the browser decides whether to offer the composer and the server decides
 * whether to accept the write, and those two must agree. A rule enforced only on
 * the client is not a rule.
 *
 * Nothing here knows who may read a takeaway, because nobody may: they are only
 * ever returned to their own author. See the table comment in @/db/schema.
 */

/** The brief asks for two or three short bullets, so three is the cap. */
export const MAX_BULLETS = 3;

/** Per bullet. Short by design — these are takeaways, not minutes. */
export const MAX_BULLET_LEN = 200;

/**
 * Bullets are stored as one newline-separated text column rather than a row
 * each. Keeps the unique-index idempotency the upserts rely on, and nothing
 * addresses an individual bullet.
 */
export const BULLET_SEPARATOR = '\n';

/**
 * Normalise arbitrary input into at most MAX_BULLETS clean lines.
 *
 * Accepts either an array or a single newline-separated string, because the
 * composer sends an array and a paste into one box sends the other. Blank lines
 * are dropped rather than preserved: an empty bullet is not a bullet, and
 * keeping them would let someone pad a note to the cap with whitespace.
 *
 * Returns null when nothing survives, or when any single line is over length —
 * silently truncating someone's words is worse than telling them.
 */
export function parseBullets(input: unknown): string[] | null {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/\r?\n/)
      : null;
  if (!raw) return null;

  const lines: string[] = [];
  for (const line of raw) {
    if (typeof line !== 'string') return null;
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_BULLET_LEN) return null;
    lines.push(trimmed);
  }

  if (lines.length === 0 || lines.length > MAX_BULLETS) return null;
  return lines;
}

/** Storage form. */
export function serializeBullets(bullets: string[]): string {
  return bullets.join(BULLET_SEPARATOR);
}

/** Read form. Tolerates \r\n from rows written by anything but parseBullets. */
export function splitBullets(stored: string): string[] {
  return stored.split(/\r?\n/).map(b => b.trim()).filter(Boolean);
}

/**
 * Session statuses that mean the sip never took place, so there is nothing to
 * take away from it.
 *
 * No-shows are deliberately NOT here. Being stood up is exactly the kind of
 * thing someone wants a private note about, and since nobody else can read it
 * there is no one to hurt. 'completed' is likewise not required: it is only ever
 * written by the sip-completion cron when both sides rate 3+, so requiring it
 * would hide the composer from most sessions that really happened.
 */
const NEVER_HAPPENED = new Set(['cancelled_late', 'cancelled_ok']);

export function sessionWasCancelled(sessionStatus: string | null | undefined): boolean {
  return !!sessionStatus && NEVER_HAPPENED.has(sessionStatus);
}

/**
 * Whether a booked 1:1 is far enough along to write about.
 *
 * Falls back to the response time for a request that was accepted but never got
 * a time on the calendar — the sip may still have happened over email, and the
 * seeker should not be locked out of their own notes because nobody pressed
 * "schedule".
 */
export function requestIsWritable(
  request: { status: string; scheduledAt: Date | string | null; respondedAt: Date | string | null; sessionStatus: string | null },
  now = Date.now()
): boolean {
  if (request.status !== 'accepted') return false;
  if (sessionWasCancelled(request.sessionStatus)) return false;
  const marker = request.scheduledAt ?? request.respondedAt;
  if (!marker) return false;
  const at = new Date(marker).getTime();
  return !Number.isNaN(at) && at <= now;
}

/** Whether a room has happened. An ended room counts however long it ran. */
export function roomIsWritable(
  room: { status: string; startedAt: Date | string | null },
  now = Date.now()
): boolean {
  if (room.status === 'ended') return true;
  if (room.status === 'scheduled') return false;
  if (!room.startedAt) return false;
  const at = new Date(room.startedAt).getTime();
  return !Number.isNaN(at) && at <= now;
}
