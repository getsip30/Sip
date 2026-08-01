import { auth, clerkClient } from '@clerk/nextjs/server';
import { withTimeout, withRetry } from '@/lib/external';
import { logSwallowed } from '@/lib/logger';

const CLERK_TIMEOUT_MS = 5000;

/**
 * Primary email for a user, preferring the session claim over a network call.
 *
 * Most routes only needed the address, but every one of them was paying for a
 * round trip to Clerk on the hot path. `auth()` is local to the request, so this
 * usually resolves without leaving the process.
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  const { sessionClaims } = await auth();
  const claimed = (sessionClaims as { email?: string; primary_email?: string } | null)?.email
    ?? (sessionClaims as { primary_email?: string } | null)?.primary_email;
  if (typeof claimed === 'string' && claimed.includes('@')) return claimed;

  const user = await getClerkUser(userId);
  return user?.emailAddresses?.[0]?.emailAddress ?? null;
}

/** Fetch a Clerk user with a timeout and one retry. Returns null on failure. */
export async function getClerkUser(userId: string) {
  try {
    return await withRetry(
      'clerk.getUser',
      async () => {
        const client = await clerkClient();
        return withTimeout('clerk', CLERK_TIMEOUT_MS, client.users.getUser(userId));
      },
      { attempts: 2, baseDelayMs: 200 }
    );
  } catch (err) {
    logSwallowed('clerk.get_user_failed', err, { userId });
    return null;
  }
}

/**
 * Resolve many users at once with bounded concurrency.
 *
 * Notification fan-out previously awaited one getUser per follower in sequence,
 * so a mentor with hundreds of followers produced hundreds of serial round trips
 * inside a single background task.
 */
export async function getClerkEmails(userIds: string[], concurrency = 8): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(userIds)];

  for (let i = 0; i < unique.length; i += concurrency) {
    const slice = unique.slice(i, i + concurrency);
    const users = await Promise.all(slice.map((id) => getClerkUser(id)));
    users.forEach((u, idx) => {
      const email = u?.emailAddresses?.[0]?.emailAddress;
      if (email) out.set(slice[idx], email);
    });
  }

  return out;
}
