import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sipNotes, requests, seekers, mentors } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { mutationLimiter } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mentorId = searchParams.get('mentorId');
    const mine = searchParams.get('mine');
    if (!mentorId) return NextResponse.json({ error: 'mentorId required' }, { status: 400 });

    if (mine === 'true') {
      const { userId } = await auth();
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const result = await db.select().from(sipNotes).where(and(eq(sipNotes.mentorId, mentorId), eq(sipNotes.status, 'pending'))).orderBy(desc(sipNotes.createdAt));
      return NextResponse.json(result);
    }

    const result = await db.select().from(sipNotes).where(and(eq(sipNotes.mentorId, mentorId), eq(sipNotes.status, 'approved'))).orderBy(desc(sipNotes.createdAt));
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'GET /api/sip-notes');
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const seekerEmail = clerkUser.emailAddresses[0]?.emailAddress;
    if (!seekerEmail) return NextResponse.json({ error: 'No verified email on account' }, { status: 400 });

    const { mentorId, seekerName, note } = await req.json();
    if (!mentorId || !seekerName || !note) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (note.length > 1000) return NextResponse.json({ error: 'Note is too long' }, { status: 400 });

    const targetMentor = await db.select().from(mentors).where(eq(mentors.id, mentorId));
    if (targetMentor[0]?.clerkId === userId) {
      return NextResponse.json({ error: "You can't leave a note on your own mentor profile." }, { status: 403 });
    }

    const priorRequest = await db.select().from(requests).where(and(eq(requests.mentorId, mentorId), eq(requests.seekerEmail, seekerEmail), eq(requests.status, 'accepted')));
    if (priorRequest.length === 0) {
      return NextResponse.json({ error: "You can only leave a note after an accepted sip with this mentor." }, { status: 403 });
    }

    const created = await db.insert(sipNotes).values({ mentorId, seekerName, seekerEmail, note, status: 'pending' }).returning();

    let streakInfo = null;
    const seekerRows = await db.select().from(seekers).where(eq(seekers.email, seekerEmail));
    const seeker = seekerRows[0];
    if (seeker) {
      const now = new Date();
      let newStreak = 1;
      if (seeker.lastNoteAt) {
        const diffDays = (now.getTime() - new Date(seeker.lastNoteAt).getTime()) / 86400000;
        if (diffDays < 1) {
          newStreak = seeker.currentStreak;
        } else if (diffDays <= 7) {
          newStreak = seeker.currentStreak + 1;
        } else {
          newStreak = 1;
        }
      }
      const newLongest = Math.max(seeker.longestStreak, newStreak);
      await db.update(seekers).set({ currentStreak: newStreak, longestStreak: newLongest, lastNoteAt: now }).where(eq(seekers.id, seeker.id));
      streakInfo = { currentStreak: newStreak, longestStreak: newLongest };
    }

    return NextResponse.json({ ...created[0], streak: streakInfo });
  } catch (err) {
    return handleApiError(err, 'POST /api/sip-notes');
  }
}