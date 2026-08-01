import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Mentor',
  description: 'Open your door and change someone\'s path. List yourself on Sip, stay in control, and show up when you want to, with no scheduling required.',
  openGraph: {
    title: 'Become a Mentor | Sip',
    description: 'Open your door and change someone\'s path. Stay in control, show up when you want to.',
    url: 'https://getsip.co/mentors/signup',
  },
};

export default function MentorSignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}