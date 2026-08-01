import { db } from '@/db';
import { mentors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { publicMentor } from '@/lib/mentor';
import { isUuid } from '@/lib/validate';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json(null, { status: 404 });
  const result = await db.select().from(mentors).where(eq(mentors.id, id));
  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(publicMentor(result[0]));
}