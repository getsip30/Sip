import type { Metadata } from 'next';
import { noIndex } from '@/lib/site';

/**
 * Live session rooms. Never indexable: a room URL is a live video conversation
 * between two named people, and the page title alone would leak who is talking
 * to whom. robots.txt disallows /rooms/ as well, but that only prevents
 * fetching — this is the directive that keeps a room out of the index if the
 * URL is ever shared somewhere a crawler can see it.
 */
export const metadata: Metadata = noIndex('Live session');

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
