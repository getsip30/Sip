import type { mentors } from '@/db/schema';

/**
 * Shape a mentor row for any PUBLIC consumer (directory, leaderboard, profile
 * page, AI match). This is an ALLOWLIST on purpose: new columns added to the
 * mentors table stay private until someone deliberately exposes them here.
 *
 * Never add: clerkId, email, contactEmail, calendarLink, googleCalendarLink, referralCode,
 * invitedByClerkId, banned, lastOpenNotifiedAt. contactEmail and calendarLink
 * are only released to a seeker after the mentor accepts their request
 * (see GET /api/my-sips).
 */
export function publicMentor(m: typeof mentors.$inferSelect) {
  return {
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    role: m.role,
    company: m.company,
    bio: m.bio,
    topics: m.topics,
    availability: m.availability,
    isOpen: m.isOpen,
    xp: m.xp,
    sipCount: m.sipCount,
    badges: m.badges,
    avatarData: m.avatarData,
    avgResponseMinutes: m.avgResponseMinutes,
    createdAt: m.createdAt,
    linkedin: m.showLinkedin ? m.linkedin : null,
    showLinkedin: m.showLinkedin,
  };
}
