import { pgTable, pgEnum, text, timestamp, boolean, uuid, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const referralEvents = pgTable('referral_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  referrerClerkId: text('referrer_clerk_id').notNull(),
  referredClerkId: text('referred_clerk_id').notNull(),
  referredRole: text('referred_role').notNull(),
  milestone: text('milestone').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const mentors = pgTable('mentors', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(),
  company: text('company').notNull(),
  bio: text('bio').notNull(),
  topics: text('topics').notNull(),
  calendarLink: text('calendar_link'),
  /** Google Calendar appointment schedule, offered alongside calendarLink. */
  googleCalendarLink: text('google_calendar_link'),
  contactEmail: text('contact_email'),
  availability: text('availability').notNull(),
  linkedin: text('linkedin'),
  showLinkedin: boolean('show_linkedin').default(false).notNull(),
  isOpen: boolean('is_open').default(true).notNull(),
  /**
   * Skip the manual accept step: an incoming request is confirmed on arrival and
   * the seeker is sent the mentor's booking link straight away. Opt-in, because
   * turning it on releases the mentor's contact method to anyone who asks.
   */
  autoAccept: boolean('auto_accept').default(false).notNull(),
  xp: integer('xp').default(0).notNull(),
  sipCount: integer('sip_count').default(0).notNull(),
  /**
   * @deprecated Legacy CSV of badge slugs ('first-sip,regular,...'). The
   * mentorBadges table is the single source of truth for badges; nothing reads
   * this column any more.
   *
   * It is still WRITTEN by the sip-completion cron, on purpose, for one release
   * cycle. The column has existed for months and the cost of keeping a shadow
   * write is one UPDATE on a path that already runs several; the cost of being
   * wrong about the last reader is a mentor's badges silently vanishing. Once
   * the cycle is up, drop in this order: the write in the reminders cron, the
   * mapping in @/lib/badge-legacy, then the column.
   *
   * Do not add readers. The thresholds here have already diverged from the real
   * ones — 'legend' (25) and 'goat' (50) have no equivalent in mentorBadges and
   * both collapse into super_mentor (20) — so this column can disagree with the
   * badges a mentor actually holds.
   */
  badges: text('badges').default('').notNull(),
  avatarData: text('avatar_data'),
  avgResponseMinutes: integer('avg_response_minutes'),
  lastOpenNotifiedAt: timestamp('last_open_notified_at'),
  referralCode: text('referral_code').unique(),
  invitedByClerkId: text('invited_by_clerk_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  banned: boolean('banned').default(false).notNull(),
});

export const seekers = pgTable('seekers', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  age: integer('age'),
  linkedin: text('linkedin'),
  interests: text('interests').default('').notNull(),
  avatarData: text('avatar_data'),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastNoteAt: timestamp('last_note_at'),
  lastMatchEmailAt: timestamp('last_match_email_at'),
  lastCheckinAt: timestamp('last_checkin_at'),
  referralCode: text('referral_code').unique(),
  invitedByClerkId: text('invited_by_clerk_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  banned: boolean('banned').default(false).notNull(),
});

/**
 * The badge kinds a mentor can hold. A real Postgres enum rather than free text:
 * a badge type reaches the certificate renderer and the public profile, and the
 * set is small and closed, so the database refusing an unknown value is worth
 * the migration cost of adding one later (`ALTER TYPE ... ADD VALUE`).
 */
// Kept as a literal rather than imported from '@/lib/badge-meta', because
// drizzle-kit compiles this file on its own and does not resolve the '@/' path
// alias. `@/lib/badges` asserts at compile time that the two lists still match.
export const badgeTypeEnum = pgEnum('badge_type', [
  'founding_mentor',
  'first_sip',
  'five_sips',
  'ten_sips',
  'super_mentor',
]);

/**
 * One row per badge a mentor has earned.
 *
 * A table rather than more slugs in `mentors.badges`, because each award now
 * carries its own date (it is printed on the shareable certificate) and needs to
 * be individually addressable — the dashboard has to know which badges it has
 * already shown a modal for.
 *
 * The unique index is what makes awarding idempotent: `checkAndAwardBadges` runs
 * on every completed sip and after the backfill, and both rely on a conflicting
 * insert being a no-op rather than on having read first.
 */
export const mentorBadges = pgTable('badges', {
  id: uuid('id').defaultRandom().primaryKey(),
  mentorId: uuid('mentor_id').references(() => mentors.id, { onDelete: 'cascade' }).notNull(),
  badgeType: badgeTypeEnum('badge_type').notNull(),
  awardedAt: timestamp('awarded_at').defaultNow().notNull(),
  /**
   * When the mentor was shown the "you earned this" modal. Null means they have
   * not seen it yet, which is the only thing that triggers it — otherwise the
   * modal would reappear on every dashboard load.
   */
  seenAt: timestamp('seen_at'),
}, (t) => [
  index('badges_mentor_id_idx').on(t.mentorId),
  uniqueIndex('badges_mentor_type_idx').on(t.mentorId, t.badgeType),
]);

export const rooms = pgTable('rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  mentorId: uuid('mentor_id').references(() => mentors.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  roomName: text('room_name').notNull().unique(),
  roomUrl: text('room_url').notNull(),
  status: text('status').default('live').notNull(), // live | scheduled | ended
  mode: text('mode').default('individual').notNull(), // individual | batch
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  scheduledAt: timestamp('scheduled_at'),
}, (t) => [
  index('rooms_mentor_id_idx').on(t.mentorId),
  index('rooms_status_idx').on(t.status),
  index('rooms_scheduled_at_idx').on(t.scheduledAt),
]);

export const requests = pgTable('requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  mentorId: uuid('mentor_id').references(() => mentors.id, { onDelete: 'cascade' }).notNull(),
  originAskId: uuid('origin_ask_id').references(() => asks.id, { onDelete: 'set null' }),
  originRoomId: uuid('origin_room_id').references(() => rooms.id, { onDelete: 'set null' }),
  seekerClerkId: text('seeker_clerk_id'),
  seekerName: text('seeker_name').notNull(),
  seekerEmail: text('seeker_email').notNull(),
  seekerLinkedin: text('seeker_linkedin'),
  message: text('message').notNull(),
  status: text('status').default('pending').notNull(),
  seekerConsentToShow: boolean('seeker_consent_to_show').default(false).notNull(),
  mentorConsentToShow: boolean('mentor_consent_to_show').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  respondedAt: timestamp('responded_at'),
  mentorNote: text('mentor_note'),
  scheduledAt: timestamp('scheduled_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: text('cancelled_by'),
  reminderSentAt: timestamp('reminder_sent_at'),
  sipCountedAt: timestamp('sip_counted_at'),
  // Which booking method the mentor actually shared: 'calendar' | 'google' |
  // 'email'. Previously the choice only picked an email template and was then
  // forgotten, so nothing downstream could tell what the seeker was given.
  sharedContactMethod: text('shared_contact_method'),
  // Set when a mentor skips the pending step and sends their link immediately,
  // which distinguishes that from a request they accepted after reviewing.
  linkSentAt: timestamp('link_sent_at'),
  /**
   * What actually happened at the scheduled time:
   * 'scheduled' | 'completed' | 'no_show_mentor' | 'no_show_seeker' |
   * 'cancelled_late' | 'cancelled_ok'.
   *
   * Deliberately NULLABLE with no default, rather than NOT NULL DEFAULT
   * 'scheduled'. A default would backfill every request ever made — including
   * pending, declined and long-cancelled ones — as 'scheduled', which is a
   * claim about history that is simply untrue. Null means "this request predates
   * no-show tracking, or never got as far as having a session", and every reader
   * has to handle that anyway.
   *
   * Plain text, not a pgEnum, matching the `status` column above. The value list
   * is still settling, and `ALTER TYPE ... ADD VALUE` is not reversible, which
   * is the opposite of what an in-progress feature wants. Values are constrained
   * in @/lib/no-show instead.
   */
  sessionStatus: text('session_status'),
  /**
   * Set when the seeker answers the "still coming?" prompt in the 1h reminder.
   * Tracking only — nothing blocks or cancels a booking that is never confirmed.
   */
  confirmed: boolean('confirmed').default(false).notNull(),
  /**
   * Unguessable token behind the confirm link in the 1h reminder email, minted
   * when that email is sent. Seekers can be email-only (seekerClerkId is
   * nullable), so the confirm action cannot require a signed-in Clerk session.
   */
  confirmToken: text('confirm_token'),
}, (t) => [
  index('requests_mentor_id_idx').on(t.mentorId),
  index('requests_seeker_clerk_id_idx').on(t.seekerClerkId),
  index('requests_origin_ask_id_idx').on(t.originAskId),
  index('requests_session_status_idx').on(t.sessionStatus),
  uniqueIndex('requests_confirm_token_idx').on(t.confirmToken),
]);

/**
 * One row per no-show report. Logging only for now: nothing here punishes
 * anyone, it exists so there is real data to look at before deciding what
 * should.
 *
 * Shaped after `flags` below, which already solves the same problem for
 * conduct reports — reporter and reported are Clerk ids plus a role, not
 * foreign keys, because mentors and seekers live in separate tables and a
 * seeker may have no row at all.
 *
 * The unique index makes marking idempotent, the same trick `badges` and
 * `nudges` use: a double-submit conflicts instead of stacking duplicates.
 */
export const noShowReports = pgTable('no_show_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  requestId: uuid('request_id').references(() => requests.id, { onDelete: 'cascade' }).notNull(),
  /** Clerk id of whoever pressed the button. Always signed in, so never null. */
  reportedByClerkId: text('reported_by_clerk_id').notNull(),
  /**
   * Clerk id of the person reported, NULLABLE on purpose: a seeker who was
   * invited by email and never signed up has no Clerk id to record. The report
   * is still worth keeping — requestId identifies who it was about — it just
   * cannot be counted against an account.
   */
  reportedClerkId: text('reported_clerk_id'),
  reportedRole: text('reported_role').notNull(), // mentor | seeker
  /** Optional screenshot or recording link the reporter pasted in. */
  evidenceUrl: text('evidence_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('no_show_reports_request_id_idx').on(t.requestId),
  // Drives the rolling 30-day counter in Phase 4.
  index('no_show_reports_reported_created_idx').on(t.reportedClerkId, t.createdAt),
  uniqueIndex('no_show_reports_request_reporter_idx').on(t.requestId, t.reportedByClerkId),
]);

/**
 * One row per nudge actually sent, so a reminder cannot go out twice.
 *
 * A ledger rather than a column per reminder: the kinds are open-ended, and the
 * unique index does the idempotency for free. A conflicting insert means it has
 * already been sent, which is exactly the check the cron needs, and it holds
 * even if two runs overlap.
 */
export const nudges = pgTable('nudges', {
  id: uuid('id').defaultRandom().primaryKey(),
  requestId: uuid('request_id').references(() => requests.id, { onDelete: 'cascade' }).notNull(),
  kind: text('kind').notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('nudges_request_kind_idx').on(t.requestId, t.kind),
]);

export const sipFeedback = pgTable('sip_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  requestId: uuid('request_id').references(() => requests.id, { onDelete: 'cascade' }).notNull(),
  mentorId: uuid('mentor_id').references(() => mentors.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(), // mentor | seeker
  raterClerkId: text('rater_clerk_id'),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('sip_feedback_request_id_idx').on(t.requestId),
  index('sip_feedback_mentor_id_idx').on(t.mentorId),
  uniqueIndex('sip_feedback_unique_idx').on(t.requestId, t.role),
]);

export const sipNotes = pgTable('sip_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  mentorId: uuid('mentor_id').references(() => mentors.id, { onDelete: 'cascade' }).notNull(),
  seekerName: text('seeker_name').notNull(),
  seekerEmail: text('seeker_email'),
  note: text('note').notNull(),
  status: text('status').default('pending').notNull(),
  /**
   * Whether an approved note is shown on the mentor's public profile. Defaults
   * to true so approving still publishes exactly as it did before; the flag adds
   * a way to take a note off the profile without deleting it, which used to be
   * the only option.
   */
  featured: boolean('featured').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('sip_notes_mentor_id_idx').on(t.mentorId),
]);

/**
 * Private post-session feedback from a live room, from both sides. Never
 * surfaced to mentors or seekers anywhere in the app: it exists for the admin
 * view only, which is why it is kept apart from sipFeedback.
 *
 * sipFeedback covers request-based sips and its requestId is NOT NULL, so a
 * live room, which has no request behind it, has nowhere to go there. Keyed on
 * the room plus the rater instead.
 */
export const sessionFeedback = pgTable('session_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
  mentorId: uuid('mentor_id').references(() => mentors.id, { onDelete: 'cascade' }).notNull(),
  seekerClerkId: text('seeker_clerk_id').notNull(),
  role: text('role').notNull(), // mentor | seeker
  raterClerkId: text('rater_clerk_id').notNull(),
  rating: integer('rating').notNull(),
  wouldSipAgain: boolean('would_sip_again'),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('session_feedback_room_id_idx').on(t.roomId),
  index('session_feedback_mentor_id_idx').on(t.mentorId),
  // One submission per person per counterpart per room, so a double submit
  // cannot stack duplicates.
  uniqueIndex('session_feedback_unique_idx').on(t.roomId, t.seekerClerkId, t.role),
]);

/**
 * Private notes a mentor writes about a seeker during a live session. Not to be
 * confused with sipNotes, which are seeker-written testimonials shown publicly
 * once a mentor approves them. These are never exposed to the seeker.
 *
 * The seeker is keyed by Clerk id, matching queueEntries, requests, asks and
 * follows. That is the identifier a live room actually holds, and it stays
 * usable for a seeker who has no row of their own.
 *
 * sessionId points at the room the note was taken in and survives that room
 * being removed, so sessionDate is stored rather than derived from the join.
 */
export const sessionNotes = pgTable('session_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  mentorId: uuid('mentor_id').references(() => mentors.id, { onDelete: 'cascade' }).notNull(),
  sessionId: uuid('session_id').references(() => rooms.id, { onDelete: 'set null' }),
  seekerClerkId: text('seeker_clerk_id').notNull(),
  seekerName: text('seeker_name').notNull(),
  sessionDate: timestamp('session_date').defaultNow().notNull(),
  noteText: text('note_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('session_notes_mentor_id_idx').on(t.mentorId),
  // Drives the dashboard accordion, which reads newest date first for one mentor.
  index('session_notes_mentor_date_idx').on(t.mentorId, t.sessionDate),
]);

export const queueEntries = pgTable('queue_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
  seekerClerkId: text('seeker_clerk_id').notNull(),
  seekerName: text('seeker_name').notNull(),
  topic: text('topic'),
  status: text('status').default('waiting').notNull(), // waiting | active | done | left
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  calledAt: timestamp('called_at'),
  doneAt: timestamp('done_at'),
}, (t) => [
  index('queue_entries_room_id_idx').on(t.roomId),
  index('queue_entries_seeker_clerk_id_idx').on(t.seekerClerkId),
  index('queue_entries_room_status_idx').on(t.roomId, t.status),
  uniqueIndex('queue_entries_active_unique_idx').on(t.roomId, t.seekerClerkId).where(sql`status in ('waiting', 'active')`),
]);

export const asks = pgTable('asks', {
  id: uuid('id').defaultRandom().primaryKey(),
  mentorId: uuid('mentor_id').references(() => mentors.id, { onDelete: 'cascade' }).notNull(),
  seekerClerkId: text('seeker_clerk_id').notNull(),
  seekerName: text('seeker_name').notNull(),
  seekerEmail: text('seeker_email').notNull(),
  question: text('question').notNull(),
  answer: text('answer'),
  status: text('status').default('pending').notNull(),
  seekerConsentToShow: boolean('seeker_consent_to_show').default(false).notNull(),
  mentorConsentToShow: boolean('mentor_consent_to_show').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  answeredAt: timestamp('answered_at'),
}, (t) => [
  index('asks_mentor_id_idx').on(t.mentorId),
  index('asks_seeker_clerk_id_idx').on(t.seekerClerkId),
]);


export const follows = pgTable('follows', {
  id: uuid('id').defaultRandom().primaryKey(),
  seekerClerkId: text('seeker_clerk_id').notNull(),
  mentorId: uuid('mentor_id').references(() => mentors.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('follows_mentor_id_idx').on(t.mentorId),
  index('follows_seeker_clerk_id_idx').on(t.seekerClerkId),
  uniqueIndex('follows_unique_idx').on(t.seekerClerkId, t.mentorId),
]);

export const consents = pgTable('consents', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkId: text('clerk_id').notNull(),
  roomId: uuid('room_id'),
  context: text('context').notNull(), // 'call' | 'message'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const siteFeedback = pgTable('site_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkId: text('clerk_id'),
  path: text('path'),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('site_feedback_created_at_idx').on(t.createdAt),
]);

export const flags = pgTable('flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
  reporterClerkId: text('reporter_clerk_id').notNull(),
  reporterRole: text('reporter_role').notNull(), // mentor | seeker
  reportedClerkId: text('reported_clerk_id').notNull(),
  reportedName: text('reported_name').notNull(),
  reason: text('reason').notNull(),
  details: text('details').notNull(),
  status: text('status').default('open').notNull(), // open | dismissed | actioned
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
}, (t) => [
  index('flags_reported_clerk_id_idx').on(t.reportedClerkId),
  index('flags_room_id_idx').on(t.roomId),
]);