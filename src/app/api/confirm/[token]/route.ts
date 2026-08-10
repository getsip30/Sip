import { db } from '@/db';
import { requests } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { isUuid } from '@/lib/validate';

/**
 * "Yes, I'll be there", from the T-1h reminder email.
 *
 * POST rather than GET, and reached through a page with a button rather than
 * straight from the email link. Corporate mail scanners and link previewers
 * fetch every URL in an inbound message, so a GET that mutates would mark sips
 * confirmed for seekers who never opened the email — which would make the flag
 * worthless for the one thing it exists to measure.
 *
 * Unauthenticated by design: the token IS the credential. Seekers can be
 * email-only — `requests.seekerClerkId` is nullable — so requiring a signed-in
 * session would lock out exactly the people most likely to forget a booking.
 *
 * Confirming does nothing but record the answer. Nothing is blocked or
 * cancelled for a sip that is never confirmed.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    // Tokens are randomUUID, so anything else cannot match and is rejected
    // before it reaches the database.
    if (!isUuid(token)) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });

    const { success, reset } = await mutationLimiter.limit(limitKey(req));
    if (!success) return tooManyRequests(reset);

    const updated = await db
      .update(requests)
      .set({ confirmed: true })
      .where(and(eq(requests.confirmToken, token), eq(requests.status, 'accepted')))
      .returning({ id: requests.id, scheduledAt: requests.scheduledAt });

    if (updated.length === 0) {
      return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 });
    }

    return NextResponse.json({ confirmed: true, scheduledAt: updated[0].scheduledAt });
  } catch (err) {
    return handleApiError(err, 'POST /api/confirm/[token]');
  }
}
