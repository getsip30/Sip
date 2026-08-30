import { db } from '@/db';
import { mentorExperiences, type mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
    /**
     * The mentor's own tags. Public because they are the whole point: a seeker
     * scanning the directory should see a person, not a job title. Unlike
     * `experiences`, these ride along on every list payload — they are a handful
     * of short strings already on the row, so there is nothing extra to fetch.
     */
    tags: m.tags,
    availability: m.availability,
    isOpen: m.isOpen,
    xp: m.xp,
    sipCount: m.sipCount,
    /**
     * @deprecated The legacy CSV column. Badges now come from the badges table
     * (see badgesForMentor / badgesForMentors); no caller in this repo reads
     * this field. Kept on the payload for one release cycle only, alongside the
     * column itself, so an unknown consumer does not break mid-deprecation.
     */
    badges: m.badges,
    avatarData: m.avatarData,
    avgResponseMinutes: m.avgResponseMinutes,
    createdAt: m.createdAt,
    linkedin: m.showLinkedin ? m.linkedin : null,
    showLinkedin: m.showLinkedin,
  };
}

/**
 * A mentor's public work history, in display order.
 *
 * Kept out of `publicMentor` on purpose. That function shapes a row the caller
 * already has, and the directory endpoint runs it over every open mentor —
 * folding a second table in would turn one query into an N+1 across the whole
 * list. The section is only rendered on a profile, which is a single-row page
 * and can afford one extra query.
 */
export async function experiencesForMentor(mentorId: string) {
  return db
    .select({
      id: mentorExperiences.id,
      company: mentorExperiences.company,
      title: mentorExperiences.title,
      isCurrent: mentorExperiences.isCurrent,
    })
    .from(mentorExperiences)
    .where(eq(mentorExperiences.mentorId, mentorId))
    .orderBy(mentorExperiences.sortOrder);
}
