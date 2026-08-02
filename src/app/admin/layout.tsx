import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';

/**
 * Admin gate.
 *
 * Middleware only enforces that /admin(.*) is signed in, so any account could
 * load the shell. Every admin API already answers 403, so nothing leaked, but
 * the page rendered its own chrome and told a stranger this route exists and
 * what it is for.
 *
 * This runs on the server for every request to the segment, so it holds for a
 * typed URL the same as a link, and the page below it stays a client component
 * without needing to know about any of it.
 *
 * Non-admins are sent to the landing page rather than shown an error, since
 * "you are not an admin" is not information worth confirming. The 403s on the
 * API routes stay as they are: this is the second lock, not a replacement.
 */
/**
 * Forced dynamic on purpose, not as a formality.
 *
 * isAdmin() returns false without touching auth() when ADMIN_EMAIL is unset, so
 * on a build where that variable is missing the layout uses no dynamic API at
 * all and Next happily prerenders the segment, baking one gate result into the
 * output for every future visitor. Whether an authorisation check runs per
 * request should not depend on which environment variables happened to exist at
 * build time.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect('/');
  return <>{children}</>;
}
