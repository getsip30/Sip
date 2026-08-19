import { db } from '@/db';
import { mentors } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { matchMentors } from '@/lib/groq';
import { handleApiError } from '@/lib/api-handler';
import { emailLimiter, getIp } from '@/lib/ratelimit';
import { publicMentor } from '@/lib/mentor';

export async function POST(req: Request) {
  try {
    const ip = getIp(req);
    const { success } = await emailLimiter.limit(ip);
    if (!success) return NextResponse.json({ error: 'Too many requests. Try again in a bit.' }, { status: 429 });

    const { query } = await req.json();
    if (!query || typeof query !== 'string') return NextResponse.json({ error: 'query is required' }, { status: 400 });
    if (query.length > 500) return NextResponse.json({ error: 'Query is too long' }, { status: 400 });

    const openMentors = await db.select().from(mentors)
      .where(and(eq(mentors.isOpen, true), eq(mentors.banned, false), isNull(mentors.deletedAt)));
    if (openMentors.length === 0) return NextResponse.json({ matches: [] });

    const matches = await matchMentors(query, openMentors);

    const enriched = matches
      .map(m => {
        const mentor = openMentors.find(om => om.id === m.id);
        return mentor ? { ...publicMentor(mentor), reason: m.reason } : null;
      })
      .filter(Boolean);

    return NextResponse.json({ matches: enriched });
  } catch (err) {
    return handleApiError(err, 'POST /api/match');
  }
}