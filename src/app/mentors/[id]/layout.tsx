import type { Metadata } from 'next';
import { jsonLdScript } from '@/lib/utils';
import { db } from '@/db';
import { mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await db.select().from(mentors).where(eq(mentors.id, id));
  const mentor = result[0];

  if (!mentor) {
    return {
      title: 'Mentor Not Found',
      robots: { index: false, follow: false },
    };
  }

  const name = `${mentor.firstName} ${mentor.lastName}`;
  const title = `Talk to ${name}, ${mentor.role} at ${mentor.company}`;
  const description = mentor.bio || `Request a live conversation with ${name}, ${mentor.role} at ${mentor.company}, on Sip.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://getsip.co/mentors/${id}`,
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function MentorProfileLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.select().from(mentors).where(eq(mentors.id, id));
  const mentor = result[0];

  const jsonLd = mentor ? {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: `${mentor.firstName} ${mentor.lastName}`,
      jobTitle: mentor.role,
      worksFor: {
        '@type': 'Organization',
        name: mentor.company,
      },
      description: mentor.bio,
    },
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}