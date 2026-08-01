import { db } from '@/db';
import { mentors, seekers, rooms, requests, flags, queueEntries, sipFeedback, asks, sipNotes, referralEvents, consents, follows } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';

export async function GET() {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [allMentors, allSeekers, allRooms, recentRequests, openFlags, activeQueues, allFeedback, allAsks, allSipNotes, allReferrals, allConsents, allFollows] = await Promise.all([
      db.select().from(mentors).orderBy(desc(mentors.createdAt)).limit(1000),
      db.select().from(seekers).orderBy(desc(seekers.createdAt)).limit(1000),
      db.select().from(rooms).orderBy(desc(rooms.startedAt)).limit(200),
      db.select().from(requests).orderBy(desc(requests.createdAt)).limit(300),
      db.select().from(flags).where(eq(flags.status, 'open')),
      db.select().from(queueEntries).limit(1000),
      db.select().from(sipFeedback).orderBy(desc(sipFeedback.createdAt)).limit(300),
      db.select().from(asks).orderBy(desc(asks.createdAt)).limit(200),
      db.select().from(sipNotes).orderBy(desc(sipNotes.createdAt)).limit(200),
      db.select().from(referralEvents).orderBy(desc(referralEvents.createdAt)).limit(200),
      db.select().from(consents).orderBy(desc(consents.createdAt)).limit(200),
      db.select().from(follows).orderBy(desc(follows.createdAt)).limit(200),
    ]);

    const liveRooms = allRooms.filter(r => r.status === 'live');

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
      totalAsks: allAsks.length,
      pendingAsks: allAsks.filter(a => a.status === 'pending').length,
      totalNotes: allSipNotes.length,
      totalReferralSignups: allReferrals.filter(r => r.milestone === 'signed_up').length,
      totalReferralConversions: allReferrals.filter(r => r.milestone === 'first_sip_booked').length,
      totalFollows: allFollows.length,
      totalConsents: allConsents.length,
    };

    return NextResponse.json({
      stats,
      mentors: allMentors,
      seekers: allSeekers,
      rooms: allRooms,
      requests: recentRequests,
      feedback: allFeedback,
      asks: allAsks,
      notes: allSipNotes,
      referrals: allReferrals,
      follows: allFollows,
      consents: allConsents,
    });
  } catch (err) {
    return handleApiError(err, 'GET /api/admin/overview');
  }
}
