import { pgTable, text, timestamp, boolean, uuid, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
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
  contactEmail: text('contact_email'),
  availability: text('availability').notNull(),
  linkedin: text('linkedin'),
  showLinkedin: boolean('show_linkedin').default(false).notNull(),
  isOpen: boolean('is_open').default(true).notNull(),   
  xp: integer('xp').default(0).notNull(),
  sipCount: integer('sip_count').default(0).notNull(),
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

export const rooms = pgTable('rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  mentorId: uuid('mentor_id').references(() => mentors.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  roomName: text('room_name').notNull().unique(),
  roomUrl: text('room_url').notNull(),
  status: text('status').default('live').notNull(),
  mode: text('mode').default('individual').notNull(), // individual | batch
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
}, (t) => [
  index('rooms_mentor_id_idx').on(t.mentorId),
  index('rooms_status_idx').on(t.status),
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
  scheduledAt: timestamp('scheduled_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: text('cancelled_by'),
  reminderSentAt: timestamp('reminder_sent_at'),
}, (t) => [
  index('requests_mentor_id_idx').on(t.mentorId),
  index('requests_seeker_clerk_id_idx').on(t.seekerClerkId),
  index('requests_origin_ask_id_idx').on(t.originAskId),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('sip_notes_mentor_id_idx').on(t.mentorId),
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