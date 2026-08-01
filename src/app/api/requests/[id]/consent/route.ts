import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { requests, mentors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-handler";
import { recordAbuseSignal } from '@/lib/abuse';
import { mutationLimiter } from "@/lib/ratelimit";
import { isUuid } from '@/lib/validate';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: "Too many requests. Slow down a bit." }, { status: 429 });

    const existing = await db.select().from(requests).where(eq(requests.id, id));
    const r = existing[0];
    if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const { consent } = await req.json();
    if (typeof consent !== "boolean") return NextResponse.json({ error: "consent must be true or false" }, { status: 400 });

    if (r.seekerClerkId === userId) {
      const updated = await db.update(requests).set({ seekerConsentToShow: consent }).where(eq(requests.id, id)).returning();
      return NextResponse.json(updated[0]);
    }

    const mentorResult = await db.select().from(mentors).where(eq(mentors.clerkId, userId));
    if (mentorResult[0]?.id === r.mentorId) {
      const updated = await db.update(requests).set({ mentorConsentToShow: consent }).where(eq(requests.id, id)).returning();
      return NextResponse.json(updated[0]);
    }

    void recordAbuseSignal('auth_denied', userId, { route: 'requests.consent', requestId: id });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err) {
    return handleApiError(err, 'PATCH /api/requests/[id]/consent');
  }
}