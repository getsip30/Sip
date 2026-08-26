import { auth } from '@clerk/nextjs/server';
import { getUserEmail } from '@/lib/clerk';
import { db } from '@/db';
import { reflections, requests, seekers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter } from '@/lib/ratelimit';
import { recordAbuseSignal } from '@/lib/abuse';
import { isUuid } from '@/lib/validate';
import { isReflectionOpen, parseAnswer, MAX_ANSWER_LENGTH } from '@/lib/reflections';

type ReflectionOut = {
  id: string;
  requestId: string;
  didDifferently: string | null;
  counterfactual: string | null;
  shareable: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function shape(row: typeof reflections.$inferSelect): ReflectionOut {
  return {
    id: row.id,
    requestId: row.requestId,
    didDifferently: row.didDifferently,
    counterfactual: row.counterfactual,
    shareable: row.shareable,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Write the seeker's reflection on a sip that has happened.
 *
 * Conventions copied from POST /api/takeaways, the closest existing neighbour:
 * Clerk auth, the mutation limiter, ownership proved from the request row rather
 * than taken from the body, a ban check on the side the caller is acting as, and
 * handleApiError for anything unhandled.
 *
 * Upsert rather than a plain insert, again like takeaways. The prompt stays on
 * the card once it appears, so a second submit is a normal thing for a seeker to
 * do; the unique index on (request_id, seeker_clerk_id) turns that into an edit
 * instead of a duplicate row.
 *
 * Only the seeker writes here. The mentor has their own post-sip surfaces, and
 * these two questions are about what changed for the person who asked.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { requestId, didDifferently, counterfactual, shareable } = await req.json();

    if (!requestId || !isUuid(requestId)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const did = parseAnswer(didDifferently);
    const counter = parseAnswer(counterfactual);
    if (did === undefined || counter === undefined) {
      return NextResponse.json(
        { error: `Keep each answer under ${MAX_ANSWER_LENGTH} characters.` },
        { status: 400 }
      );
    }
    if (!did && !counter) {
      return NextResponse.json({ error: 'Answer at least one of the two questions.' }, { status: 400 });
    }
    if (shareable != null && typeof shareable !== 'boolean') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const found = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
    const r = found[0];
    if (!r) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Matched on Clerk id or email, because a seeker can be invited by email and
    // sign up later — the same pairing GET /api/my-sips and POST /api/takeaways
    // use. The mentor is not offered this form at all.
    const email = await getUserEmail(userId);
    const isSeeker =
      r.seekerClerkId === userId ||
      (!!email && email.toLowerCase() === r.seekerEmail.toLowerCase());
    if (!isSeeker) {
      void recordAbuseSignal('auth_denied', userId, { route: 'reflections.write', requestId });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (r.status !== 'accepted') {
      return NextResponse.json({ error: 'Only accepted sips can be reflected on' }, { status: 400 });
    }
    // Re-checked server-side, not just in the browser. The card hides the form
    // until the call is an hour behind; this is what actually enforces it, and
    // it is computed from the stored time on every call rather than read off a
    // flag some job was meant to have set.
    if (!isReflectionOpen(r.scheduledAt)) {
      return NextResponse.json(
        { error: 'You can reflect once the sip has happened.' },
        { status: 400 }
      );
    }

    // A missing seekers row is tolerated for the same reason takeaways tolerates
    // it: a request can be raised by email long before the person signs up, and
    // eligibility here is already proven by the sip itself.
    const profile = await db.select({ banned: seekers.banned }).from(seekers)
      .where(eq(seekers.clerkId, userId)).limit(1);
    if (profile[0]?.banned) {
      return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
    }

    const saved = await db.insert(reflections)
      .values({
        requestId: r.id,
        seekerClerkId: userId,
        // Taken from the request row, never from the body: the seeker cannot
        // file a reflection against a mentor they did not sip with.
        mentorId: r.mentorId,
        didDifferently: did,
        counterfactual: counter,
        shareable: shareable === true,
      })
      .onConflictDoUpdate({
        target: [reflections.requestId, reflections.seekerClerkId],
        set: {
          didDifferently: did,
          counterfactual: counter,
          shareable: shareable === true,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json(shape(saved[0]));
  } catch (err) {
    return handleApiError(err, 'POST /api/reflections');
  }
}
