import type { mentors } from '@/db/schema';
import { escapeHtml, safeExternalUrl } from '@/lib/utils';

export type ContactMethod = 'calendar' | 'email';

export type BookingOption = {
  method: ContactMethod;
  /** Shown on the mentor's own picker. */
  label: string;
  /** A URL for link methods, an address for email. */
  value: string;
};

type MentorRow = typeof mentors.$inferSelect;

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
export function bookingOptions(mentor: MentorRow): BookingOption[] {
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
  mentor: MentorRow,
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
