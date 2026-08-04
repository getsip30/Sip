import { db } from '@/db';
import { mentors, seekers, rooms, requests, flags, queueEntries, sipFeedback, asks, sipNotes, referralEvents, consents, follows } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';
import { badgesForMentors } from '@/lib/badges';

export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);


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

    // One grouped query for the whole page rather than one per mentor row.
    const badgesByMentor = await badgesForMentors(allMentors.map(m => m.id));

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
      totalBadges: Object.values(badgesByMentor).reduce((sum, list) => sum + list.length, 0),
      autoAcceptMentors: allMentors.filter(m => m.autoAccept).length,
    };

    return NextResponse.json({
      stats,
      mentors: allMentors.map(m => ({
        ...m,
        badgeTypes: (badgesByMentor[m.id] ?? []).map(b => b.badgeType),
      })),
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
