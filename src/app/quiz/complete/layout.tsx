import type { Metadata } from 'next';
import { noIndex } from '@/lib/site';

/** A redirect stop between Clerk and a mentor profile. Nothing to index. */
export const metadata: Metadata = noIndex('Getting you matched');

export default function QuizCompleteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
