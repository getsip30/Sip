import { requireOnboarded } from '@/lib/onboarding';

/**
 * Seeker-side gate. This sits in a route group so it wraps /seekers alone:
 * /seekers/onboarding and /seekers/[id] resolve outside it. Gating the whole
 * /seekers segment would put seeker onboarding behind the seeker onboarding
 * check and loop forever.
 *
 * Logged-out visitors still get the public mentor directory, which is what this
 * route has always served them. The gate is for signed-in users who never
 * finished seeker onboarding and currently reach a dashboard with no row behind
 * it. Checks the seeker role only: a mentor profile grants nothing here.
 */
export default async function SeekerDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireOnboarded('seeker', { allowSignedOut: true });
  return <>{children}</>;
}
