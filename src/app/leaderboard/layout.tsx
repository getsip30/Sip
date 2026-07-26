import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'See the most active mentors on Sip.',
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}