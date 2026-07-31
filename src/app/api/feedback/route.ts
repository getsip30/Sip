import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { message, path } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Empty" }, { status: 400 });

  await resend.emails.send({
    from: "feedback@getsip.co",
    to: "your-email@getsip.co", // replace
    subject: "New Sip feedback",
    text: `Path: ${path}\n\n${message}`,
  });

  return NextResponse.json({ ok: true });
}