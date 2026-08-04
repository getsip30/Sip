import type { MetadataRoute } from 'next';
import { db } from '@/db';
import { mentors } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { absoluteUrl } from '@/lib/site';
import { logSwallowed } from '@/lib/logger';

/**
 * The sitemap was a hand-written list of seven static pages. Two things were
 * wrong with that beyond it being manual:
 *
 *  1. Not one mentor profile was listed. Mentor profiles are the only pages on
 *     the site targeting long-tail intent ("talk to a product manager at X"),
 *     they are the pages a search visitor is most likely to convert from, and
 *     nothing linked to them from server-rendered HTML either (the landing page
 *     fetches mentors client-side), so they were genuinely orphaned: no path
 *     for a crawler to discover them at all.
 *
 *  2. /answers and /seekers were missing, which are the other two public
 *     content pages.
 *
 * lastModified now reflects real data rather than "whenever this file was
 * evaluated". Sending Date.now() for a static legal page on every fetch teaches
 * a crawler that the timestamp is meaningless, and it stops being used as a
 * recrawl signal.
 */

// Revalidate hourly. The mentor list changes when someone signs up, which is
// not often enough to justify a database hit on every crawler request, and an
// hour-stale sitemap costs nothing.
export const revalidate = 3600;

/** Static pages, with honest last-modified dates for content that rarely moves. */
const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number; lastModified: string }[] = [
  { path: '/', changeFrequency: 'daily', priority: 1.0, lastModified: '2026-08-03' },
  { path: '/seekers', changeFrequency: 'daily', priority: 0.9, lastModified: '2026-08-03' },
  { path: '/mentors/signup', changeFrequency: 'monthly', priority: 0.9, lastModified: '2026-08-03' },
  { path: '/answers', changeFrequency: 'weekly', priority: 0.8, lastModified: '2026-08-03' },
  { path: '/about', changeFrequency: 'monthly', priority: 0.7, lastModified: '2026-08-03' },
  { path: '/leaderboard', changeFrequency: 'weekly', priority: 0.5, lastModified: '2026-08-03' },
  { path: '/conduct', changeFrequency: 'yearly', priority: 0.3, lastModified: '2026-08-03' },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3, lastModified: '2026-08-03' },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3, lastModified: '2026-08-03' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: absoluteUrl(r.path),
    lastModified: new Date(r.lastModified),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  let mentorEntries: MetadataRoute.Sitemap = [];

  try {
    // Banned mentors are excluded: their profile still resolves for anyone
    // holding the link, but inviting a crawler to index it would be
    // volunteering a page we have already decided should not be promoted.
    const rows = await db
      .select({
        id: mentors.id,
        createdAt: mentors.createdAt,
        isOpen: mentors.isOpen,
      })
      .from(mentors)
      .where(eq(mentors.banned, false))
      .orderBy(desc(mentors.createdAt))
      .limit(5000);

    mentorEntries = rows.map((m) => ({
      url: absoluteUrl(`/mentors/${m.id}`),
      lastModified: m.createdAt ?? new Date(),
      changeFrequency: 'weekly' as const,
      // A mentor currently taking conversations is a more useful result than
      // one who has closed their door, so they are worth crawling sooner.
      priority: m.isOpen ? 0.8 : 0.6,
    }));
  } catch (err) {
    // A database blip must not produce a 500 for /sitemap.xml. Google treats a
    // failing sitemap as an error against the whole property, whereas a sitemap
    // that is temporarily missing its dynamic half is just a smaller sitemap.
    logSwallowed('sitemap: mentor query failed', err);
  }

  return [...staticEntries, ...mentorEntries];
}
