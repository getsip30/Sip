import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { mutationLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { anonymizeAccount } from '@/lib/account-deletion';
import { withTimeout, withRetry } from '@/lib/external';
import { logError, logInfo } from '@/lib/logger';

/**
 * The phrase the client must echo back. Checked here as well as in the modal,
 * so the confirmation is a property of the endpoint rather than of one button
 * that a direct POST could route around.
 */
const CONFIRM_PHRASE = 'DELETE';

const CLERK_TIMEOUT_MS = 5000;

/**
 * Delete the caller's own account.
 *
 * Order is deliberate: the database is scrubbed FIRST, then the Clerk user is
 * removed. If Clerk fails afterwards the person still holds a login, but their
 * data is already gone and signing in lands them on onboarding as a new user —
 * an annoyance they can retry out of. The reverse order fails much worse: with
 * the login destroyed first, a database failure would strand their personal data
 * with no authenticated path left to reach it.
 *
 * Deleting the Clerk user fires a `user.deleted` webhook that calls
 * `anonymizeAccount` again. That second pass is a no-op — see the idempotency
 * note in @/lib/account-deletion — and is what closes the gap if this route dies
 * between the two steps.
 */
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success, reset } = await mutationLimiter.limit(limitKey(req, userId));
    if (!success) return tooManyRequests(reset);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const confirm = (body as { confirm?: unknown } | null)?.confirm;
    if (confirm !== CONFIRM_PHRASE) {
      return NextResponse.json(
        { error: `Type ${CONFIRM_PHRASE} to confirm.` },
        { status: 400 }
      );
    }

    const result = await anonymizeAccount(userId);

    try {
      await withRetry(
        'clerk.deleteUser',
        async () => {
          const client = await clerkClient();
          return withTimeout('clerk', CLERK_TIMEOUT_MS, client.users.deleteUser(userId));
        },
        { attempts: 2, baseDelayMs: 200 }
      );
    } catch (err) {
      // The data is already scrubbed, so this is not a failure the user needs to
      // act on — but it leaves a Clerk account with nothing behind it, which is
      // worth an alert rather than a swallow.
      logError('account.clerk_delete_failed', err, { userId, ...result });
      return NextResponse.json(
        {
          ok: true,
          clerkDeleted: false,
          message: 'Your data has been removed. Signing you out now.',
        },
        { status: 200 }
      );
    }

    logInfo('account.deleted', { ...result });
    return NextResponse.json({ ok: true, clerkDeleted: true });
  } catch (err) {
    return handleApiError(err, 'DELETE /api/account');
  }
}
