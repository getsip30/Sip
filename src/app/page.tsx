import type { Metadata } from 'next';
import { jsonLdScript } from '@/lib/utils';
import Landing from './Landing';

export const metadata: Metadata = {
  title: 'Sip: talk to someone who already did the thing',
  description:
    'Sip puts students in front of people working the jobs they want. Say what you are stuck on, see who can help, and have the conversation this week.',
  openGraph: {
    title: 'Sip: talk to someone who already did the thing',
    description: 'Students and mentors, matched for real conversations. No cold outreach.',
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
    description:
      'Live mentorship platform connecting students with working professionals for real-time conversations.',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <Landing />
    </>
  );
}
