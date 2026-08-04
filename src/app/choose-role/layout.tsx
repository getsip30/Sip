import type { Metadata } from 'next';
import { noIndex } from '@/lib/site';

/**
 * An interstitial that only exists for a signed-in account holding both roles.
 * It has no content for a search visitor and would be a dead end if surfaced.
 */
export const metadata: Metadata = noIndex('Choose your role');

export default function ChooseRoleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
