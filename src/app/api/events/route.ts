import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { logEvent, isEventType, CLIENT_LOGGABLE } from '@/lib/events';
import { mutationLimiter, limitKey } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';

/**
 * Beacon for the two funnel steps that are page views rather than actions.
 *
 * Deliberately open to signed-out callers: `landing_view` is the top of the
 * funnel and happens before anyone has an account, so requiring auth would
 * measure nothing. What keeps that safe is the allowlist — only CLIENT_LOGGABLE
 * types are accepted, and the events that represent real conversions
 * (sip_requested, sip_accepted, signup_complete) are written server-side at the
 * point they happen and are rejected here.
 *
 * The identity is taken from the session, never from the body, so a caller
 * cannot attribute a view to someone else.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    const { success } = await mutationLimiter.limit(limitKey(req, userId));
    if (!success) return new NextResponse(null, { status: 429 });

    const body = await req.json().catch(() => null);
    const eventType = (body as { eventType?: unknown } | null)?.eventType;

    if (!isEventType(eventType) || !CLIENT_LOGGABLE.includes(eventType)) {
      return NextResponse.json({ error: 'Unknown event' }, { status: 400 });
    }

    await logEvent(eventType, { clerkId: userId ?? null });

    // 204: the caller is a fire-and-forget beacon with nothing to do with a body.
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err, 'POST /api/events');
  }
}
