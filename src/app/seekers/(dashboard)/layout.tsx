import type { Metadata } from 'next';
import { requireOnboarded } from '@/lib/onboarding';
import { db } from '@/db';
import { mentors } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { jsonLdScript } from '@/lib/utils';
import {
  absoluteUrl,
  canonical,
  graph,
  breadcrumbJsonLd,
  ORGANIZATION_ID,
  WEBSITE_ID,
} from '@/lib/site';
import TrackEvent from '@/components/TrackEvent';

/**
 * Seeker-side gate. This sits in a route group so it wraps /seekers alone:
 * /seekers/onboarding and /seekers/[id] resolve outside it. Gating the whole
 * /seekers segment would put seeker onboarding behind the seeker onboarding
 * check and loop forever.
 *
 * Logged-out visitors still get the public mentor directory, which is what this
 * route has always served them. The gate is for signed-in users who never
 * finished seeker onboarding and currently reach a dashboard with no row behind
 * it. Checks the seeker role only: a mentor profile grants nothing here.
 */

/**
 * SEO note. /seekers is the mentor directory and, for a signed-out visitor, the
 * most valuable indexable page on the site after the landing page — it is the
 * one that answers "find a mentor for X". It had no metadata of its own at all,
 * so it inherited the root layout's generic title, and it was missing from the
 * sitemap entirely.
 *
 * The route serves two different things depending on who is asking: a public
 * directory to a stranger, a dashboard to a signed-in seeker. The metadata
 * describes the public face, which is the only one a crawler ever sees.
 */
export const metadata: Metadata = {
  title: 'Find a Mentor: browse people doing the job you want',
  description:
    'Browse mentors on Sip by topic, role and company. Every one of them agreed to take short, live conversations about breaking into tech, product, finance, research, grad school and more. Free to ask.',
  alternates: canonical('/seekers'),
  openGraph: {
    title: 'Find a Mentor on Sip',
    description: 'Browse people doing the job you want, and ask them about it.',
    url: absoluteUrl('/seekers'),
    type: 'website',
  },
};

export default async function SeekerDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireOnboarded('seeker', { allowSignedOut: true });

  // An ItemList of the mentors on offer, server-rendered. The directory itself
  // fetches its list on the client, so without this a crawler sees the page's
  // chrome and no indication of who is actually listed. The list also gives
  // Google an explicit set of links to the profile pages, which is the second
  // discovery path for them alongside the sitemap.
  //
  // Capped at 50: an ItemList is a summary for search, not a data dump, and a
  // directory of thousands would bloat every response for no added benefit.
  let listItems: { id: string; firstName: string; lastName: string; role: string; company: string }[] = [];
  try {
    listItems = await db
      .select({
        id: mentors.id,
        firstName: mentors.firstName,
        lastName: mentors.lastName,
        role: mentors.role,
        company: mentors.company,
      })
      .from(mentors)
      .where(eq(mentors.banned, false))
      .orderBy(desc(mentors.xp))
      .limit(50);
  } catch {
    // The directory must still render if the database is briefly unreachable.
    listItems = [];
  }

  const jsonLd = graph(
    {
      '@type': 'CollectionPage',
      '@id': `${absoluteUrl('/seekers')}#collection`,
      url: absoluteUrl('/seekers'),
      name: 'Find a Mentor',
      description: 'Browse mentors on Sip by topic, role and company.',
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
      inLanguage: 'en',
      mainEntity: {
        '@type': 'ItemList',
        name: 'Mentors on Sip',
        numberOfItems: listItems.length,
        itemListElement: listItems.map((m, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: absoluteUrl(`/mentors/${m.id}`),
          item: {
            '@type': 'Person',
            '@id': `${absoluteUrl(`/mentors/${m.id}`)}#person`,
            name: `${m.firstName} ${m.lastName}`,
            jobTitle: m.role,
            url: absoluteUrl(`/mentors/${m.id}`),
            worksFor: { '@type': 'Organization', name: m.company },
          },
        })),
      },
    },
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Find a Mentor', path: '/seekers' },
    ]),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      {children}
      {/*
        The 'browse_sips' funnel step. In the layout rather than the page so it
        fires once for the route, and so it covers the signed-out directory too:
        browsing before signing up is a real path through this funnel, and those
        rows simply carry no Clerk id.
      */}
      <TrackEvent type="browse_sips" />
      <MentorIndex mentors={listItems} />
    </>
  );
}

/**
 * A plain, server-rendered list of every mentor, at the foot of the directory.
 *
 * This exists because mentor profiles had no crawlable path to them at all.
 * Verified on production and again locally: the number of `<a href="/mentors/…">`
 * elements in the server HTML of both the landing page and this directory was
 * zero. Both render their mentor lists on the client, so the links only exist
 * once JavaScript has run and a fetch has resolved.
 *
 * That left the sitemap as the only discovery route. A sitemap tells Google a
 * URL exists; it does not pass any internal link signal, and it is a weaker
 * hint than a link. Googlebot does execute JavaScript and would eventually find
 * the client-rendered cards, but rendering is queued separately from crawling
 * and is not something to depend on for the site's most valuable pages.
 *
 * A flat index like this is the conventional fix, and it earns its place for
 * readers too: it is the only view that shows everyone at once, without the
 * filters and tabs above it.
 */
function MentorIndex({
  mentors: rows,
}: {
  mentors: { id: string; firstName: string; lastName: string; role: string; company: string }[];
}) {
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="mentor-index-heading"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '48px 16px 64px' }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <h2 id="mentor-index-heading" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          All mentors
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
          Every mentor listed on Sip, in one place.
        </p>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: '8px 24px',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          }}
        >
          {rows.map(m => (
            <li key={m.id}>
              {/*
                A real anchor, not next/link. This block is here for crawlers
                and for anyone who wants the whole list; it does not need
                prefetching, and 50 prefetch requests firing on viewport entry
                would undo the performance work done elsewhere in this pass.
              */}
              <a
                href={`/mentors/${m.id}`}
                style={{ color: 'var(--muted)', fontSize: 13.5, textDecoration: 'none', lineHeight: 1.7 }}
              >
                {m.firstName} {m.lastName} — {m.role} at {m.company}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
