import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { mentors, seekers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type Role = 'mentor' | 'seeker';

/**
 * Where an un-onboarded user of each role gets sent. Both of these double as the
 * "edit profile" screens, so they must never sit behind the gate themselves.
 */
const ONBOARDING_PATH: Record<Role, string> = {
  mentor: '/mentors/signup',
  seeker: '/seekers/onboarding',
};

/**
 * A role is onboarded when it has a row in its own table, and nothing else
 * creates those rows: the Clerk webhook only ever updates or deletes them, so
 * the only writer is the POST on that role's own onboarding endpoint. That makes
 * row presence an accurate per-role completion flag with no extra column to keep
 * in sync.
 *
 * The two roles are deliberately independent. Someone can hold either, both, or
 * neither, so a mentor row says nothing about whether seeker onboarding is done.
 */
async function hasRoleRow(role: Role, clerkId: string) {
  const table = role === 'mentor' ? mentors : seekers;
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.clerkId, clerkId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Server-side onboarding gate for a role's dashboard. Call this from the layout
 * of the segment you are protecting so it runs on every request to that route,
 * including direct URL entry and client-side soft navigation. A `useEffect`
 * redirect in the page cannot do this job: the page has already been handed to
 * the browser by the time it runs.
 *
 * `allowSignedOut` keeps a route that is genuinely public for logged-out
 * visitors public. It only suppresses the sign-in bounce; a signed-in user
 * without the role's row is still redirected into onboarding either way.
 */
export async function requireOnboarded(
  role: Role,
  { allowSignedOut = false }: { allowSignedOut?: boolean } = {}
) {
  const { userId } = await auth();

  if (!userId) {
    if (allowSignedOut) return null;
    redirect('/sign-in');
  }

  if (!(await hasRoleRow(role, userId))) redirect(ONBOARDING_PATH[role]);

  return userId;
}

/**
 * Both roles at once, for callers that need to branch on what someone holds
 * rather than gate on a single role.
 */
export async function getRoles(clerkId: string) {
  const [isMentor, isSeeker] = await Promise.all([
    hasRoleRow('mentor', clerkId),
    hasRoleRow('seeker', clerkId),
  ]);
  return { isMentor, isSeeker };
}
