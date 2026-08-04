import type { Metadata } from 'next';
import { noIndex } from '@/lib/site';

/**
 * Seeker profiles are personal pages belonging to people who may be as young as
 * 13, showing their first and last name, age, interests and who they have
 * spoken to. These must never be indexed, and unlike most noindex routes here
 * the reason is safeguarding rather than SEO hygiene.
 *
 * robots.txt disallows /seekers/ for the same reason. Both are needed: the
 * disallow keeps crawlers off the URL, and this keeps the page out of the index
 * if it is ever linked from somewhere a crawler does reach.
 */
export const metadata: Metadata = noIndex('Seeker profile');

export default function SeekerProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
