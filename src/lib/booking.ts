import type { mentors } from '@/db/schema';
import { escapeHtml, safeExternalUrl } from '@/lib/utils';

export type ContactMethod = 'calendar' | 'email';

/**
 * How long a mentor is held off after cancelling a 1:1 on someone, so a
 * cancellation cannot be followed straight away by another ask.
 */
export const CONNECT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type CooldownCandidate = {
  originRoomId: string | null;
  status: string;
  cancelledBy: string | null;
  cancelledAt: Date | null;
};

/**
 * When the mentor may next send this seeker a 1:1, or null if they may now.
 *
 * Scoped to 1:1s the mentor themselves cancelled. A seeker cancelling does not
 * hold the mentor off, and a declined or expired request is not a cancellation.
 * Shared so the queue endpoint and the send endpoint cannot disagree about
 * whether the button should work.
 */
export function connectCooldownUntil(history: CooldownCandidate[], now = Date.now()): Date | null {
  let latest: number | null = null;
  for (const r of history) {
    if (!r.originRoomId || r.status !== 'cancelled') continue;
    if (r.cancelledBy !== 'mentor' || !r.cancelledAt) continue;
    const expiresAt = new Date(r.cancelledAt).getTime() + CONNECT_COOLDOWN_MS;
    if (expiresAt > now && (latest === null || expiresAt > latest)) latest = expiresAt;
  }
  return latest === null ? null : new Date(latest);
}

export type BookingOption = {
  method: ContactMethod;
  /** Shown on the mentor's own picker. */
  label: string;
  /** A URL for link methods, an address for email. */
  value: string;
};

/**
 * Only the fields a booking option is built from, so the browser can reuse this
 * against the profile it fetched without reconstructing a full row.
 */
type BookingSource = Pick<typeof mentors.$inferSelect, 'calendarLink' | 'contactEmail'>;

/**
 * Every way this mentor can be booked, in the order they should be offered.
 *
 * Single source of truth for "what can this mentor share", so the in-room
 * picker, the accept dialog and the outgoing email cannot disagree about which
 * options exist. Adding a method means adding one entry here.
 *
 * Link methods are passed through safeExternalUrl, so a mentor who saved a
 * javascript: or data: URL contributes no option rather than an unsafe one.
 */
export function bookingOptions(mentor: BookingSource): BookingOption[] {
  const options: BookingOption[] = [];

  const calendar = safeExternalUrl(mentor.calendarLink);
  if (calendar) options.push({ method: 'calendar', label: 'Calendar link', value: calendar });

  if (mentor.contactEmail) options.push({ method: 'email', label: 'Email', value: mentor.contactEmail });

  return options;
}

/**
 * Resolve the option to actually use. Falls back to the only available option
 * when the mentor has just one, which is why the callers do not need to ask for
 * a choice unless there is a genuine choice to make.
 */
export function resolveBookingOption(
  mentor: BookingSource,
  requested?: string | null
): BookingOption | null {
  const options = bookingOptions(mentor);
  if (options.length === 0) return null;
  const match = options.find(o => o.method === requested);
  return match ?? options[0];
}

/**
 * The call-to-action block for a transactional email. Values are escaped here
 * rather than at each call site, since every one of these is interpolated into
 * raw HTML that Sip sends on a mentor's behalf.
 */
export function bookingEmailBlock(option: BookingOption): string {
  if (option.method === 'email') {
    return `<p style="color:#70B5F9;font-size:16px;font-weight:600;margin-bottom:0;">Book a Google Meet on this email only: ${escapeHtml(option.value)}</p>`;
  }
  return `<a href="${escapeHtml(option.value)}" style="display:inline-block;background:#0A66C2;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Book Your Sip →</a>`;
}
