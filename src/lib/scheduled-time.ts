/**
 * One place that turns a stored `scheduled_at` into text a person reads.
 *
 * The problem this solves: `scheduled_at` is a `timestamp` with no zone, so for
 * most of this app's life the time a seeker picked was rendered against
 * whoever happened to be looking. The seeker booked 4:00 PM in New York, the
 * mentor in Berlin opened the same card and read 10:00 PM, and the reminder
 * email — which had no zone to work with at all — said something in UTC and
 * hoped the "UTC" suffix carried it. Three surfaces, three answers, one
 * meeting.
 *
 * `scheduled_at_timezone` is the missing half. Together the two columns name a
 * single instant *and* the zone the booking was made in, and that pair is the
 * source of truth: every surface renders in the stored zone, never the
 * viewer's, so everyone reads the same string. The zone abbreviation is always
 * shown — a time in someone else's zone is a trap without one.
 */

/**
 * What a row with no stored zone is read as.
 *
 * Not an arbitrary pick: rows written before the column existed were
 * backfilled to UTC by migration 0026, because UTC is what the reminder emails
 * had already been telling people those rows were. Anything still null here —
 * a row a client sent an unparseable zone for — lands in the same place, which
 * is the behaviour these surfaces had before this module existed.
 */
export const FALLBACK_TIMEZONE = 'UTC';

/**
 * Zones already checked, so the common case is a map lookup.
 *
 * Validating means constructing an `Intl.DateTimeFormat`, and these formatters
 * run once per card in a list — worth not re-doing per row.
 */
const zoneValidity = new Map<string, boolean>();

/**
 * Is this a zone `Intl` will actually format in?
 *
 * The string arrives from a browser and is stored verbatim, so it is untrusted
 * in the ordinary way: a stale zone name, a client that sends something odd, or
 * a value typed straight into the database. `Intl` throws `RangeError` on an
 * unknown zone, which would take down a dashboard render for one bad row.
 */
export function isValidTimezone(timezone: string | null | undefined): timezone is string {
  if (!timezone || typeof timezone !== 'string' || timezone.length > 64) return false;
  const cached = zoneValidity.get(timezone);
  if (cached !== undefined) return cached;
  let valid: boolean;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    valid = true;
  } catch {
    valid = false;
  }
  zoneValidity.set(timezone, valid);
  return valid;
}

/** The zone to format in: the stored one when it is usable, UTC when it is not. */
export function resolveTimezone(timezone: string | null | undefined): string {
  return isValidTimezone(timezone) ? timezone : FALLBACK_TIMEZONE;
}

/**
 * The viewer's own zone, for capture at booking time.
 *
 * Only ever called to record what zone a booking was made in — never to decide
 * how to display one. Returns null on a server render or a runtime without
 * `Intl` so callers can simply omit the field rather than store a guess.
 */
export function detectBrowserTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimezone(tz) ? tz : null;
  } catch {
    return null;
  }
}

/**
 * The stored value as an absolute instant.
 *
 * Three shapes reach the formatters and they have to agree, or the same sip
 * renders differently depending on which query loaded it:
 *
 *   - a `Date`, from a Drizzle select — already correct, Drizzle reads the
 *     column back as `value + '+0000'`;
 *   - an ISO string with a zone, from JSON over the wire;
 *   - a bare SQL timestamp (`2026-10-03 20:00:00`), from the `db.execute` raw
 *     queries in reminders and attendance, which bypass Drizzle's column
 *     mapping and land here as whatever the driver made of type 1114.
 *
 * The third is the one that bites: a naive string has no zone, so `new Date()`
 * would read it in the *server's* zone and shift the instant by the deploy's
 * offset. Pinning it to UTC matches what Drizzle does with the identical bytes,
 * so both paths produce the same instant on any host.
 */
export function toInstant(scheduledAt: Date | string | null | undefined): Date | null {
  if (!scheduledAt) return null;
  if (scheduledAt instanceof Date) return isNaN(scheduledAt.getTime()) ? null : scheduledAt;
  const raw = String(scheduledAt).trim();
  if (!raw) return null;
  const naive = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw);
  const date = new Date(naive ? `${raw.replace(' ', 'T')}Z` : raw);
  return isNaN(date.getTime()) ? null : date;
}

function parts(
  scheduledAt: Date | string | null | undefined,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string | null {
  const instant = toInstant(scheduledAt);
  if (!instant) return null;
  const zone = resolveTimezone(timezone);
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: zone }).format(instant);
  } catch {
    // Belt and braces: `resolveTimezone` has already vetted the zone, so this
    // only fires on a runtime missing zone data. UTC is always available.
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: FALLBACK_TIMEZONE }).format(instant);
  }
}

/**
 * The full string, zone included: `Wed, Oct 3, 2026, 4:00 PM EDT`.
 *
 * The default for anywhere a time appears on its own — a list row, an email
 * sentence, an admin line — where the reader has no other clue what zone they
 * are looking at.
 */
export function formatScheduledAt(
  scheduledAt: Date | string | null | undefined,
  timezone: string | null | undefined
): string | null {
  return parts(scheduledAt, timezone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/** As `formatScheduledAt`, but `—` instead of null, for rendering straight into JSX. */
export function formatScheduledAtOr(
  scheduledAt: Date | string | null | undefined,
  timezone: string | null | undefined,
  fallback = '—'
): string {
  return formatScheduledAt(scheduledAt, timezone) ?? fallback;
}

/** Just the day: `Wednesday, October 3`. For cards that give the date its own line. */
export function formatScheduledDate(
  scheduledAt: Date | string | null | undefined,
  timezone: string | null | undefined
): string | null {
  return parts(scheduledAt, timezone, { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * Just the clock, with the zone: `4:00 PM EDT`.
 *
 * The zone rides along even though the date was split off, because this is the
 * half that is ambiguous — a reader who misjudges the zone misses the call.
 */
export function formatScheduledTime(
  scheduledAt: Date | string | null | undefined,
  timezone: string | null | undefined
): string | null {
  return parts(scheduledAt, timezone, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

/**
 * The calendar day a scheduled time falls on, in its own zone: `2026-10-03`.
 *
 * For deciding whether two bookings are on the same day. `Date.toDateString()`
 * answers that in whatever zone the process happens to run in, which is the
 * server's — not the seeker's, and not stable across hosts. This asks the
 * question where it means something.
 *
 * ISO-ordered on purpose, so the strings also sort and group correctly.
 */
export function scheduledDayKey(
  scheduledAt: Date | string | null | undefined,
  timezone: string | null | undefined
): string | null {
  const instant = toInstant(scheduledAt);
  if (!instant) return null;
  const zone = resolveTimezone(timezone);
  // en-CA renders YYYY-MM-DD, which is the format this needs to sort in.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant);
}
