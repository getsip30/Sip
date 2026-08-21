import type { Metadata } from 'next';
import { jsonLdScript } from '@/lib/utils';
import {
  absoluteUrl,
  canonical,
  graph,
  ORGANIZATION_ID,
  WEBSITE_ID,
  SITE_NAME,
} from '@/lib/site';
import Landing from './Landing';
import TrackEvent from '@/components/TrackEvent';

export const metadata: Metadata = {
  title: 'Sip: talk to someone who already did the thing',
  description:
    'Sip puts students in front of people working the jobs they want. Say what you are stuck on, see who can help, and have the conversation this week. Free, live, and no cold outreach.',
  alternates: canonical('/'),
  openGraph: {
    title: 'Sip: talk to someone who already did the thing',
    description: 'Students and mentors, matched for real conversations. No cold outreach.',
    url: absoluteUrl('/'),
    type: 'website',
  },
};

/**
 * Questions a visitor has before signing up, mirrored into FAQPage structured
 * data below. These are rendered on the page too — Google requires the answers
 * to be visible, and an FAQ that exists only in JSON-LD is a guidelines
 * violation as well as a wasted chance to answer the person reading.
 */
export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: 'What is Sip?',
    a: 'Sip is a free mentorship platform that connects students and early-career people with professionals for short, live conversations. You describe what you are stuck on, Sip shows you who can help, and you talk — usually within the week.',
  },
  {
    q: 'How much does Sip cost?',
    a: 'Nothing. Sip is free for students and free for mentors. Nobody is charged and nobody is paid; the point is to remove the cold-outreach step, not to run a marketplace.',
  },
  {
    q: 'How is this different from cold messaging someone on LinkedIn?',
    a: 'Everyone listed on Sip has already agreed to have these conversations, and set their own topics and availability. You are not interrupting a stranger and hoping for a reply — you are asking someone who signed up to be asked.',
  },
  {
    q: 'How long does a conversation take?',
    a: 'About twenty minutes. Most sips are one short conversation rather than an ongoing mentorship, which is exactly why mentors are willing to say yes.',
  },
  {
    q: 'Do I need to book a time?',
    a: 'Not necessarily. Some mentors go live and you join a queue, which needs no scheduling at all. Others accept your request and you agree a time from there.',
  },
  {
    q: 'Who can use Sip?',
    a: 'Anyone 13 or older who is trying to work out a next step: students, career changers, and people early in a field who want to hear from someone a few years ahead of them.',
  },
];

export default function Page() {
  // Organization and WebSite live in the root layout and are referenced here by
  // @id rather than restated, so the whole site resolves to one organisation
  // instead of several near-identical ones.
  const jsonLd = graph(
    {
      '@type': 'WebPage',
      '@id': `${absoluteUrl('/')}#webpage`,
      url: absoluteUrl('/'),
      name: 'Sip: talk to someone who already did the thing',
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
      inLanguage: 'en',
      primaryImageOfPage: { '@type': 'ImageObject', url: absoluteUrl('/opengraph-image') },
    },
    {
      '@type': 'FAQPage',
      '@id': `${absoluteUrl('/')}#faq`,
      mainEntity: HOME_FAQ.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
    // What Sip actually is, in the vocabulary a search engine understands.
    // Free-of-charge is stated explicitly because "is it free" is the most
    // common qualifying question and an Offer at price 0 can answer it in place.
    {
      '@type': 'Service',
      '@id': `${absoluteUrl('/')}#service`,
      serviceType: 'Career mentorship',
      name: `${SITE_NAME} live mentorship`,
      description:
        'Short, live one-to-one conversations between students and working professionals, matched by what the student is trying to figure out.',
      provider: { '@id': ORGANIZATION_ID },
      areaServed: 'Worldwide',
      audience: {
        '@type': 'Audience',
        audienceType: 'Students and early-career professionals',
      },
      availableChannel: {
        '@type': 'ServiceChannel',
        serviceUrl: absoluteUrl('/seekers'),
        availableLanguage: 'English',
      },
      offers: {
        '@type': 'Offer',
        price: 0,
        priceCurrency: 'CAD',
        availability: 'https://schema.org/InStock',
        url: absoluteUrl('/'),
      },
    },
    // Mirrors the three steps rendered in the "How it works" section.
    {
      '@type': 'HowTo',
      '@id': `${absoluteUrl('/')}#howto`,
      name: 'How to find a mentor on Sip',
      description: 'Three steps from being stuck to having the conversation.',
      totalTime: 'PT20M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CAD', value: 0 },
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Say what you are stuck on',
          text: 'One sentence is enough. Sip reads it against every mentor currently taking conversations and ranks who fits.',
          url: absoluteUrl('/#how-it-works'),
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'See who can actually help',
          text: 'Real job, real company, and the specific topics they agreed to talk about.',
          url: absoluteUrl('/#how-it-works'),
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Have the conversation',
          text: 'Join a live room and take your place in the queue, or book a time that suits you both. Most first sips happen within the week.',
          url: absoluteUrl('/#how-it-works'),
        },
      ],
    },
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <Landing faq={HOME_FAQ} />
      {/*
        Top of the funnel. Client-side so this page stays statically rendered —
        see TrackEvent for why that matters here specifically.
      */}
      <TrackEvent type="landing_view" />
    </>
  );
}
