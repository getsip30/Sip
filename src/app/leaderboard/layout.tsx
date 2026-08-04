import type { Metadata } from 'next';
import { canonical, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Mentor Leaderboard',
  description:
    'The mentors showing up the most on Sip, ranked by completed conversations. Mentors earn XP when a sip finishes and both sides leave feedback.',
  alternates: canonical('/leaderboard'),
  openGraph: {
    title: 'Mentor Leaderboard | Sip',
    description: 'The people showing up the hardest, ranked by completed conversations.',
    url: absoluteUrl('/leaderboard'),
    type: 'website',
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
