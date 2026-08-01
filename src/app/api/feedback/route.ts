import { NextResponse } from "next/server";
import { auth } from '@clerk/nextjs/server';
import { mutationLimiter, getIp } from '@/lib/ratelimit';
import { cleanText } from '@/lib/validate';
import { db } from '@/db';
import { siteFeedback } from '@/db/schema';
import { handleApiError } from '@/lib/api-handler';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    // getIp() prefers the platform-set x-vercel-forwarded-for; the raw
    // x-forwarded-for used here before is client-influenced.
    const limitKey = userId || getIp(req);
    const { success } = await mutationLimiter.limit(limitKey);
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const { message, path } = await req.json();
    const cleanMessage = cleanText(message, 1000);
    if (!cleanMessage) return NextResponse.json({ error: "Empty or too long" }, { status: 400 });

    await db.insert(siteFeedback).values({
      clerkId: userId || null,
      path: cleanText(path, 300),
      message: cleanMessage,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, 'POST /api/feedback');
  }
}