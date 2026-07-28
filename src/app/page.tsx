import type { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: 'Sip — Find Your People',
  description: 'Real conversations, zero cold messages. Join a live queue and talk to a mentor right now — no scheduling, no waiting on replies.',
  openGraph: {
    title: 'Sip — Find Your People',
    description: 'Real conversations, zero cold messages.',
    url: 'https://getsip.co',
  },
};

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Sip',
    url: 'https://getsip.co',
    logo: 'https://getsip.co/logo.png',
    description: 'Live mentorship platform connecting mentors and seekers for real-time conversations, no scheduling required.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient />
    </>
  );
}