import type { Metadata } from 'next';
import { requireOnboarded } from '@/lib/onboarding';
import { noIndex } from '@/lib/site';

/**
 * Signed-in mentor workspace. Middleware already redirects a signed-out visitor
 * to /sign-in, so a crawler never sees the content — but the redirect target
 * and the URL itself can still be indexed from an inbound link, which is what
 * this prevents.
 */
export const metadata: Metadata = noIndex('Mentor dashboard');

/**
 * Mentor-side gate. This runs on the server for every request to /dashboard, so
 * typing the URL in directly hits it the same way a link does. Checks the mentor
 * role only: a completed seeker profile grants nothing here.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireOnboarded('mentor');
  return <>{children}</>;
}
