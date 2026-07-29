import { db } from '@/db';
import { mentors, seekers, rooms, requests, flags, queueEntries, sipFeedback } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';

export async function GET() {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [allMentors, allSeekers, liveRooms, recentRequests, openFlags, activeQueues, allFeedback] = await Promise.all([
      db.select().from(mentors).orderBy(desc(mentors.createdAt)),
      db.select().from(seekers).orderBy(desc(seekers.createdAt)),
      db.select().from(rooms).where(eq(rooms.status, 'live')).orderBy(desc(rooms.startedAt)),
      db.select().from(requests).orderBy(desc(requests.createdAt)).limit(100),
      db.select().from(flags).where(eq(flags.status, 'open')),
      db.select().from(queueEntries),
      db.select().from(sipFeedback).orderBy(desc(sipFeedback.createdAt)).limit(200),
    ]);

    const stats = {
      totalMentors: allMentors.length,
      bannedMentors: allMentors.filter(m => m.banned).length,
      openMentors: allMentors.filter(m => m.isOpen).length,
      totalSeekers: allSeekers.length,
      bannedSeekers: allSeekers.filter(s => s.banned).length,
      liveRooms: liveRooms.length,
      openFlags: openFlags.length,
      pendingRequests: recentRequests.filter(r => r.status === 'pending').length,
      totalSips: recentRequests.filter(r => r.status === 'accepted').length,
      peopleInQueue: activeQueues.filter(q => q.status === 'waiting' || q.status === 'active').length,
      scheduledSips: recentRequests.filter(r => r.status === 'accepted' && r.scheduledAt).length,
      cancelledSips: recentRequests.filter(r => r.status === 'cancelled').length,
      avgRating: allFeedback.length > 0
        ? Math.round((allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length) * 10) / 10
        : null,
    };

    return NextResponse.json({
      stats,
      mentors: allMentors,
      seekers: allSeekers,
      rooms: liveRooms,
      requests: recentRequests,
      feedback: allFeedback,
    });
  } catch (err) {
    return handleApiError(err, 'GET /api/admin/overview');
  }
}
