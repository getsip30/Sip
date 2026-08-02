import { requireOnboarded } from '@/lib/onboarding';

/**
 * Mentor-side gate. This runs on the server for every request to /dashboard, so
 * typing the URL in directly hits it the same way a link does. Checks the mentor
 * role only: a completed seeker profile grants nothing here.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireOnboarded('mentor');
  return <>{children}</>;
}
