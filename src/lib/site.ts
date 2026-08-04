/**
 * Single source of truth for the site's public origin and the structured data
 * that describes it.
 *
 * Before this existed the origin was written out by hand in nine places
 * (layout metadata, every page's openGraph.url, robots' sitemap line, the
 * sitemap entries, the Organization JSON-LD). They agreed today, but nothing
 * made them agree, and a canonical host is the one string in an app that must
 * never drift: two spellings of the same page is how a site competes with
 * itself in search results.
 *
 * THE HOST IS www.getsip.co. This matches what production actually serves:
 * the apex, getsip.co, answers every request with a 308 to the www host. Before
 * this was settled the app declared the apex everywhere while the server served
 * www, so each of the 37 URLs in the sitemap redirected, and every canonical
 * pointed at a host that is not the one returning the page.
 *
 * The www spelling is the default in code rather than only an environment
 * variable, and that is deliberate. `.env*` is gitignored, so no env file in
 * this repo reaches a Vercel build; if the origin lived only in the dashboard,
 * a project restored from this source with no env configured would silently go
 * back to emitting apex canonicals — the exact bug being fixed. The env var
 * stays as an override for anyone running against a different origin, but the
 * correct production value is committed and cannot be lost.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.getsip.co').replace(/\/$/, '');

export const SITE_NAME = 'Sip';

export const SITE_TAGLINE = 'Real conversations with people who already did it';

export const SITE_DESCRIPTION =
  'Sip connects students with working professionals for short, live mentorship conversations. Say what you are stuck on, see who can help, and talk this week. No cold outreach, no scheduling limbo.';

/** Absolute URL for a site-relative path. Always used for canonicals and JSON-LD. */
export function absoluteUrl(path = '/'): string {
  if (!path.startsWith('/')) path = `/${path}`;
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * Canonical metadata for a route.
 *
 * Next resolves a relative `canonical` against `metadataBase`, which is what we
 * want: one place decides the origin. Passing the path rather than a full URL
 * also means a page cannot accidentally canonicalise itself to another host.
 */
export function canonical(path = '/') {
  return { canonical: path };
}

/**
 * The Organization entity. Referenced by @id from other nodes rather than
 * repeated, so Google resolves one organisation across the whole site instead
 * of guessing whether several similar blocks describe the same thing.
 */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export function organizationJsonLd() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    alternateName: 'Sip Mentorship',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/logo.png'),
      width: 512,
      height: 512,
    },
    image: absoluteUrl('/opengraph-image'),
    description: SITE_DESCRIPTION,
    email: 'hello@getsip.co',
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'Ontario',
        addressCountry: 'CA',
      },
    },
    areaServed: 'Worldwide',
    knowsAbout: [
      'career mentorship',
      'student career advice',
      'informational interviews',
      'breaking into tech',
      'internship and co-op search',
      'graduate school applications',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'hello@getsip.co',
      areaServed: 'Worldwide',
      availableLanguage: ['English'],
    },
  };
}

/**
 * The WebSite entity, including the sitelinks search box target. The search
 * target is the mentor directory's real query parameter, so if Google does
 * surface a search box the results page it lands on is a page that exists.
 */
export function webSiteJsonLd() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: 'en',
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/seekers?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Breadcrumbs for a route. Google renders these in place of the raw URL in
 * results, which matters most on mentor profiles where the URL is a UUID and
 * reads as noise.
 */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * Metadata for a route that must never appear in search results.
 *
 * robots.txt only asks a crawler not to *fetch* a URL. A disallowed page that
 * something links to can still be indexed — Google shows it as a bare title
 * with "No information is available for this page". Only a noindex directive
 * on the page itself removes it, and for Google to see that directive the page
 * must be crawlable. So these two mechanisms are not redundant and not
 * interchangeable: robots.txt saves crawl budget, this is what actually keeps
 * a page out of the index.
 *
 * `follow` stays on so links out of a private page still pass through to the
 * public pages they point at. `nocache`/`noarchive` stop a signed-in view being
 * kept in a search engine's cache, which for a dashboard is the difference
 * between a private page and a publicly readable snapshot of one.
 */
export function noIndex(title: string, description?: string) {
  return {
    title,
    ...(description ? { description } : {}),
    robots: {
      index: false,
      follow: true,
      nocache: true,
      googleBot: {
        index: false,
        follow: true,
        noimageindex: true,
        'max-snippet': 0,
      },
    },
  };
}

/** Wraps nodes in a single @graph so one script tag describes the whole page. */
export function graph(...nodes: unknown[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  };
}
