import type { Metadata } from 'next';
import { jsonLdScript } from '@/lib/utils';
import { canonical, graph, breadcrumbJsonLd, absoluteUrl, ORGANIZATION_ID, WEBSITE_ID } from '@/lib/site';
import { MENTOR_FAQ } from './faq';

export const metadata: Metadata = {
  title: 'Become a Mentor',
  description:
    'List yourself as a mentor on Sip and give students twenty minutes of the advice you wish you had. Free, no scheduling, and you decide when you are open and what you will talk about.',
  alternates: canonical('/mentors/signup'),
  openGraph: {
    title: 'Become a Mentor on Sip',
    description: "Twenty minutes of your experience changes someone's path. Free to join, you set the terms.",
    url: absoluteUrl('/mentors/signup'),
    type: 'website',
  },
};

export default function MentorSignupLayout({ children }: { children: React.ReactNode }) {
  // FAQPage is the rich result this page is genuinely eligible for, and the
  // answers are the same ones rendered on the page — required by Google's
  // guidelines, and the reason MENTOR_FAQ is a shared export rather than
  // duplicated prose that would drift out of sync with the visible copy.
  const jsonLd = graph(
    {
      '@type': 'FAQPage',
      '@id': `${absoluteUrl('/mentors/signup')}#faq`,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
      mainEntity: MENTOR_FAQ.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Become a Mentor', path: '/mentors/signup' },
    ]),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      {children}
    </>
  );
}
