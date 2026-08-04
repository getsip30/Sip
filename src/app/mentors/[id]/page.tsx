import { notFound } from 'next/navigation';
import { db } from '@/db';
import { mentors, sipNotes } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { publicMentor } from '@/lib/mentor';
import { isUuid } from '@/lib/validate';
import MentorProfileClient from './MentorProfileClient';

/**
 * Server half of the mentor profile.
 *
 * This exists so the page's content is in the HTML. Previously page.tsx was a
 * client component that fetched the mentor on mount, which meant the served
 * markup for every mentor profile was identical: a centred "loading..." and
 * nothing else. Crawlers were being handed a page with no name, no job title,
 * no bio and no topics, on the one route where those words are the entire
 * reason the page could rank.
 *
 * Fetching in the server component rather than the layout also lets a missing
 * or malformed id produce a genuine 404. The client version rendered a
 * "Mentor not found" screen with a 200 status — a soft 404, which invites
 * Google to index nonexistent profiles and dilutes the ones that are real.
 */

// Profiles change when a mentor edits them or a note is approved, neither of
// which needs to be instant for a crawler. Serving from cache also keeps a
// crawl of several thousand profiles off the database.
export const revalidate = 3600;

export type MentorPageProps = { params: Promise<{ id: string }> };

// Deliberately no generateStaticParams. Prebuilding the top profiles was tried
// and made the build do ~50 sequential cold reads against a remote database,
// which repeatedly blew Next's 60-second per-page budget and turned a 90-second
// build into a six-minute one. ISR gets to the same place: the first request
// for a profile renders it, `revalidate` above keeps it cached for an hour, and
// every subsequent visitor (and crawler) is served from cache. The only cost is
// one slow request per profile per hour, against a build that no longer depends
// on database latency at all.

/** Shared by the page and the layout's metadata, so both see the same row. */
export async function getMentor(id: string) {
  // Guard before querying: a non-UUID id makes Postgres raise a type error
  // rather than return no rows, which surfaced as a 500 for what is really a
  // 404. Any crawler following a mangled link was getting a server error.
  if (!isUuid(id)) return null;
  const rows = await db.select().from(mentors).where(eq(mentors.id, id));
  return rows[0] ?? null;
}

async function getNotes(mentorId: string) {
  // Same filters as the public branch of GET /api/sip-notes: approved is
  // moderation, featured is whether the mentor currently wants it shown, and
  // both must hold. seekerEmail is never selected — this renders publicly.
  return db
    .select({
      id: sipNotes.id,
      seekerName: sipNotes.seekerName,
      note: sipNotes.note,
      createdAt: sipNotes.createdAt,
    })
    .from(sipNotes)
    .where(and(eq(sipNotes.mentorId, mentorId), eq(sipNotes.status, 'approved'), eq(sipNotes.featured, true)))
    .orderBy(desc(sipNotes.createdAt));
}

export default async function MentorProfilePage({ params }: MentorPageProps) {
  const { id } = await params;
  const mentor = await getMentor(id);

  // A banned mentor's profile is not served. It used to render normally, which
  // meant a profile removed for conduct reasons stayed indexable.
  if (!mentor || mentor.banned) notFound();

  const [notes] = await Promise.all([getNotes(mentor.id)]);
  const safe = publicMentor(mentor);

  return (
    <MentorProfileClient
      mentor={{
        id: safe.id,
        firstName: safe.firstName,
        lastName: safe.lastName,
        role: safe.role,
        company: safe.company,
        bio: safe.bio,
        topics: safe.topics,
        availability: safe.availability,
        isOpen: safe.isOpen,
        xp: safe.xp,
        sipCount: safe.sipCount,
        badges: safe.badges,
        linkedin: safe.linkedin ?? undefined,
        showLinkedin: safe.showLinkedin,
        avgResponseMinutes: safe.avgResponseMinutes,
        avatarData: safe.avatarData ?? undefined,
      }}
      notes={notes.map(n => ({
        id: n.id,
        seekerName: n.seekerName,
        note: n.note,
        createdAt: n.createdAt.toISOString(),
      }))}
    />
  );
}
