import { NextResponse } from "next/server";
import { auth } from '@clerk/nextjs/server';
import { mutationLimiter } from '@/lib/ratelimit';
import { transporter } from '@/lib/mailer';

export async function POST(req: Request) {
  const { userId } = await auth();
  const limitKey = userId || req.headers.get('x-forwarded-for') || 'anon';
  const { success } = await mutationLimiter.limit(limitKey);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { message, path } = await req.json();
  if (!message?.trim() || message.length > 1000) return NextResponse.json({ error: "Empty or too long" }, { status: 400 });

  await transporter.sendmail({
    to: "your-email@getsip.co", // replace
    subject: "New Sip feedback",
    text: `Path: ${path}\n\n${message}`,
  });

  return NextResponse.json({ ok: true });
}