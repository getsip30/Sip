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
 * Holding a role, and having finished setting it up, are two different things.
 *
 * `exists` is role membership: there is a row in that role's table. Nothing else
 * creates those rows — the Clerk webhook only ever updates or deletes them, so
 * the only writer is the POST on that role's own onboarding endpoint.
 *
 * `complete` is whether the row actually carries the fields that role's
 * onboarding form refuses to submit without. Row presence was previously
 * treated as proof of both, and it is not: POST /api/seeker inserts
 * `firstName: firstName || clerkUser?.firstName || ''`, so a row with a blank
 * name is creatable — an OAuth signup with no given name on the provider
 * profile produces exactly that. Those accounts had a row, passed the gate, and
 * landed on a dashboard that then asked them to finish a profile they could
 * skip forever.
 *
 * The required set is taken from each form's own submit guard rather than
 * invented here, so the gate cannot demand something the form does not:
 *
 *   seeker  — name. Age, LinkedIn, interests and avatar are all optional
 *             (handleSubmit only blocks on a blank name; the other two are
 *             format-checked when present and skipped when absent).
 *   mentor  — first name, last name, role, company, which POST /api/mentor
 *             already rejects the request without. A mentor row therefore
 *             cannot exist incomplete; the check is stated anyway so the two
 *             roles answer the same question the same way.
 *
 * The two roles stay independent. Someone can hold either, both, or neither,
 * and a mentor row says nothing about whether seeker onboarding is done.
 */
type RoleStatus = { exists: boolean; complete: boolean };

const filled = (v: string | null | undefined) => !!v?.trim();

async function roleStatus(role: Role, clerkId: string): Promise<RoleStatus> {
  if (role === 'mentor') {
    const rows = await db
      .select({
        firstName: mentors.firstName,
        lastName: mentors.lastName,
        jobRole: mentors.role,
        company: mentors.company,
      })
      .from(mentors)
      .where(eq(mentors.clerkId, clerkId))
      .limit(1);
    const m = rows[0];
    if (!m) return { exists: false, complete: false };
    return {
      exists: true,
      complete: filled(m.firstName) && filled(m.lastName) && filled(m.jobRole) && filled(m.company),
    };
  }

  const rows = await db
    .select({ firstName: seekers.firstName })
    .from(seekers)
    .where(eq(seekers.clerkId, clerkId))
    .limit(1);
  const s = rows[0];
  if (!s) return { exists: false, complete: false };
  return { exists: true, complete: filled(s.firstName) };
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

  // `complete`, not `exists`. A half-filled row is not an onboarded user, and
  // sending them to the dashboard is how a profile stays half-filled: nothing
  // downstream ever insists. Both onboarding screens double as edit-profile and
  // prefill from the saved row, so being sent back costs the user one form they
  // can finish in seconds rather than a restart.
  //
  // This is the single choke point for every entry point that resolves to a
  // dashboard — "Open Sip" on the landing page, /choose-role, a bookmarked URL,
  // a client-side soft navigation — because it runs in the segment's layout on
  // every request. Enforcing it here rather than at each caller is what makes
  // "everywhere" true by construction instead of by inventory.
  if (!(await roleStatus(role, userId)).complete) redirect(ONBOARDING_PATH[role]);

  return userId;
}

/**
 * Both roles at once, for callers that need to branch on what someone holds
 * rather than gate on a single role.
 *
 * Deliberately reports membership (`exists`), not completeness. "Is this person
 * a seeker" and "has this person finished seeker onboarding" are different
 * questions, and callers that branch on which sides someone holds — role
 * switchers, nav links — would start hiding a role from its own owner if this
 * answered the second one.
 */
export async function getRoles(clerkId: string) {
  const [mentor, seeker] = await Promise.all([
    roleStatus('mentor', clerkId),
    roleStatus('seeker', clerkId),
  ]);
  return { isMentor: mentor.exists, isSeeker: seeker.exists };
}
