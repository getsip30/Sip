import type { Metadata } from 'next';
import { jsonLdScript } from '@/lib/utils';
import { db } from '@/db';
import { mentors, sipNotes } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { isUuid } from '@/lib/validate';
import {
  absoluteUrl,
  canonical,
  graph,
  breadcrumbJsonLd,
  ORGANIZATION_ID,
  WEBSITE_ID,
  SITE_NAME,
} from '@/lib/site';

async function loadMentor(id: string) {
  // Matches the guard in page.tsx: a non-UUID id would otherwise raise a
  // Postgres type error inside generateMetadata, turning a 404 into a 500.
  if (!isUuid(id)) return null;
  const rows = await db.select().from(mentors).where(eq(mentors.id, id));
  const mentor = rows[0];
  if (!mentor || mentor.banned) return null;
  return mentor;
}

/** Truncates on a word boundary — meta descriptions cut mid-word read as broken. */
function clamp(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}...`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const mentor = await loadMentor(id);

  if (!mentor) {
    return {
      title: 'Mentor not found',
      description: 'This mentor profile is no longer available on Sip.',
      robots: { index: false, follow: true },
    };
  }

  const name = `${mentor.firstName} ${mentor.lastName}`;
  const title = `Talk to ${name}, ${mentor.role} at ${mentor.company}`;

  // The bio alone made a poor description: it is written in the mentor's own
  // voice and often opens mid-thought, so the snippet read as a fragment with
  // no indication of what the page lets you do. Leading with the action and
  // following with their words keeps the intent clear and the snippet human.
  const topics = mentor.topics.split(',').map(t => t.trim()).filter(Boolean).slice(0, 4);
  const topicPhrase = topics.length ? ` Ask about ${topics.join(', ')}.` : '';
  const description = clamp(
    `Book a short, live conversation with ${name}, ${mentor.role} at ${mentor.company}.${topicPhrase}${mentor.bio ? ` "${mentor.bio}"` : ''}`,
    240,
  );

  return {
    title,
    description,
    alternates: canonical(`/mentors/${id}`),
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/mentors/${id}`),
      type: 'profile',
      firstName: mentor.firstName,
      lastName: mentor.lastName,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      // A mentor who has closed their door still has a profile worth keeping in
      // the index — they reopen, and the page keeps its history and its links.
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

export default async function MentorProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mentor = await loadMentor(id);

  if (!mentor) return <>{children}</>;

  const name = `${mentor.firstName} ${mentor.lastName}`;
  const url = absoluteUrl(`/mentors/${id}`);
  const topics = mentor.topics.split(',').map(t => t.trim()).filter(Boolean);

  // How many approved, visible notes this mentor has. Used only to emit an
  // interactionStatistic, never a rating. There is deliberately no
  // AggregateRating: session feedback on Sip is private between the two people
  // involved, so publishing a star rating derived from it would be both a
  // structured-data violation (ratings must be visible on the page) and a
  // breach of what those people were told when they left it.
  let noteCount = 0;
  try {
    const rows = await db
      .select({ value: count() })
      .from(sipNotes)
      .where(and(eq(sipNotes.mentorId, mentor.id), eq(sipNotes.status, 'approved'), eq(sipNotes.featured, true)));
    noteCount = rows[0]?.value ?? 0;
  } catch {
    noteCount = 0;
  }

  const person = {
    '@type': 'Person',
    '@id': `${url}#person`,
    name,
    givenName: mentor.firstName,
    familyName: mentor.lastName,
    jobTitle: mentor.role,
    description: mentor.bio || undefined,
    url,
    worksFor: { '@type': 'Organization', name: mentor.company },
    ...(topics.length ? { knowsAbout: topics } : {}),
    // Only published when the mentor chose to show it. showLinkedin is the
    // consent flag; ignoring it here would leak a profile they opted out of
    // into a machine-readable format that is easier to scrape than the page.
    ...(mentor.showLinkedin && mentor.linkedin
      ? { sameAs: [mentor.linkedin.startsWith('http') ? mentor.linkedin : `https://${mentor.linkedin}`] }
      : {}),
  };

  const jsonLd = graph(
    person,
    {
      '@type': 'ProfilePage',
      '@id': `${url}#profile`,
      url,
      name: `${name} on ${SITE_NAME}`,
      mainEntity: { '@id': `${url}#person` },
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': `${url}#person` },
      inLanguage: 'en',
      dateCreated: mentor.createdAt?.toISOString(),
      ...(noteCount > 0
        ? {
            interactionStatistic: {
              '@type': 'InteractionCounter',
              interactionType: 'https://schema.org/CommentAction',
              userInteractionCount: noteCount,
            },
          }
        : {}),
    },
    // Describes what the page offers, which is what a search visitor is
    // actually looking for: a conversation they can request, at no cost.
    {
      '@type': 'Service',
      '@id': `${url}#service`,
      serviceType: 'Career mentorship conversation',
      name: `Live mentorship conversation with ${name}`,
      description: `A short, live one-to-one conversation with ${name}, ${mentor.role} at ${mentor.company}, about ${topics.slice(0, 3).join(', ') || 'their career'}.`,
      provider: { '@id': `${url}#person` },
      brand: { '@id': ORGANIZATION_ID },
      areaServed: 'Worldwide',
      availableChannel: {
        '@type': 'ServiceChannel',
        serviceUrl: url,
        availableLanguage: 'English',
      },
      offers: {
        '@type': 'Offer',
        price: 0,
        priceCurrency: 'CAD',
        availability: mentor.isOpen ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url,
      },
    },
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Mentors', path: '/seekers' },
      { name, path: `/mentors/${id}` },
    ]),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      {children}
    </>
  );
}
