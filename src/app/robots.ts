import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

/**
 * Crawl policy.
 *
 * The previous version listed four rules that could never match anything, and
 * blocked one page that we actually want indexed:
 *
 *   /(auth)/     - a route group. Parentheses are a filesystem convention that
 *                  never appears in a URL, so this blocked nothing. The real
 *                  paths are /sign-in and /sign-up.
 *   /onboarding  - no such route. The real path is /seekers/onboarding, which
 *                  the /seekers/ rule below happens to cover.
 *   /answers     - public, human-written Q&A between named professionals and
 *                  students. This is the single best long-tail content asset on
 *                  the site and it was being withheld from search.
 *
 * Note that "Disallow: /seekers/" blocks the subtree but NOT /seekers itself,
 * which is the public mentor directory. That distinction is deliberate and is
 * why the trailing slash matters: /seekers/[id] is a seeker's personal profile,
 * and seekers can be as young as 13, so those must never be crawled.
 *
 * robots.txt controls crawling, not indexing: a disallowed URL can still be
 * indexed from an inbound link, showing up as a bare result with no snippet.
 * Every private route below therefore also serves `noindex` in its own
 * metadata, which is the directive that actually removes a page. These two
 * mechanisms are complementary and both are needed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/dashboard',
          '/choose-role',
          '/sign-in',
          '/sign-up',
          '/rooms/',
          '/seekers/',
          // Sentry's ad-blocker-evasion tunnel. Not a page; answers 404 to GET.
          '/monitoring',
          // Query strings that produce a near-duplicate of a canonical page.
          // The directory's own filters are the main source of these.
          '/*?*topic=',
          '/*?*mentor=',
          '/*?*ref=',
        ],
      },
      {
        // GPTBot and friends are left to the default allow above. This entry
        // exists only to stop the two crawlers that ignore crawl-delay from
        // hammering the directory, which hits the database on every request.
        userAgent: ['AhrefsBot', 'SemrushBot'],
        allow: '/',
        disallow: ['/api/', '/seekers/', '/rooms/'],
        crawlDelay: 10,
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
