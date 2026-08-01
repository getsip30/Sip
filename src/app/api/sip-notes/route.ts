import { auth } from '@clerk/nextjs/server';
import { getUserEmail } from '@/lib/clerk';
import { db } from '@/db';
import { sipNotes, requests, seekers, mentors } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { mutationLimiter } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { recordAbuseSignal } from '@/lib/abuse';
import { isUuid, cleanText } from '@/lib/validate';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mentorId = searchParams.get('mentorId');
    const mine = searchParams.get('mine');
    if (!mentorId) return NextResponse.json({ error: 'mentorId required' }, { status: 400 });

    if (!isUuid(mentorId)) return NextResponse.json([]);

    if (mine === 'true') {
      // Pending notes are unmoderated and carry the seeker's email, so being
      // signed in is not enough — the caller must own this mentor profile.
      const { userId } = await auth();
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const mentorSelf = await db.select({ id: mentors.id }).from(mentors).where(eq(mentors.clerkId, userId));
      if (mentorSelf[0]?.id !== mentorId) {
        void recordAbuseSignal('auth_denied', userId, { route: 'sip-notes.mine', mentorId });
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const result = await db.select().from(sipNotes).where(and(eq(sipNotes.mentorId, mentorId), eq(sipNotes.status, 'pending'))).orderBy(desc(sipNotes.createdAt));
      return NextResponse.json(result);
    }

    // Public branch: never include seekerEmail — this renders on the open profile page.
    const result = await db
      .select({ id: sipNotes.id, mentorId: sipNotes.mentorId, seekerName: sipNotes.seekerName, note: sipNotes.note, status: sipNotes.status, createdAt: sipNotes.createdAt })
      .from(sipNotes)
      .where(and(eq(sipNotes.mentorId, mentorId), eq(sipNotes.status, 'approved')))
      .orderBy(desc(sipNotes.createdAt));
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

    const seekerEmail = await getUserEmail(userId);
    if (!seekerEmail) return NextResponse.json({ error: 'No verified email on account' }, { status: 400 });

    const seekerSelf = await db.select().from(seekers).where(eq(seekers.clerkId, userId));
    if (seekerSelf[0]?.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });

    const { mentorId, seekerName, note } = await req.json();
    if (!mentorId || !seekerName || !note) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (!isUuid(mentorId)) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    const cleanNote = cleanText(note, 1000);
    if (!cleanNote) return NextResponse.json({ error: 'Note is required and must be under 1000 characters' }, { status: 400 });
    const cleanName = cleanText(seekerName, 100);
    if (!cleanName) return NextResponse.json({ error: 'Name is required and must be under 100 characters' }, { status: 400 });

    const targetMentor = await db.select().from(mentors).where(eq(mentors.id, mentorId));
    if (!targetMentor[0]) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    if (targetMentor[0].clerkId === userId) {
      return NextResponse.json({ error: "You can't leave a note on your own mentor profile." }, { status: 403 });
    }

    const priorRequest = await db.select().from(requests).where(and(eq(requests.mentorId, mentorId), eq(requests.seekerEmail, seekerEmail), eq(requests.status, 'accepted')));
    if (priorRequest.length === 0) {
      return NextResponse.json({ error: "You can only leave a note after an accepted sip with this mentor." }, { status: 403 });
    }

    const created = await db.insert(sipNotes).values({ mentorId, seekerName: cleanName, seekerEmail, note: cleanNote, status: 'pending' }).returning();

    // Key the streak off clerkId. seekers.email has no unique constraint, so
    // looking up by email could silently update a different person's row.
    let streakInfo = null;
    const seeker = seekerSelf[0];
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