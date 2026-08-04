import type { Metadata } from 'next';
import { noIndex } from '@/lib/site';

/** A signed-in-only form. Nothing here is useful to a search visitor. */
export const metadata: Metadata = noIndex('Set up your profile');

export default function SeekerOnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
