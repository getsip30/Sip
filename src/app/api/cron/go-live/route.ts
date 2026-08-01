import { db } from '@/db';
import { rooms } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { flipToLive, notifyRoomLive } from '@/lib/rooms';

/**
 * NOT registered in vercel.json — deliberately.
 *
 * Vercel Hobby allows 2 cron jobs per project (both already used by checkins and
 * reminders) and caps frequency at once per day, which is useless for this job:
 * a room scheduled for 3pm would go live at the next daily run.
 *
 * Going live is therefore handled by two backstops that need no cron:
 *   - GET /api/rooms/[id]  — flips the room the moment anyone opens it
 *   - GET /api/rooms       — flips any due room during its `after()` sweep
 *
 * On a Pro plan, add an entry to vercel.json pointing at /api/cron/go-live with
 * an every-5-minutes schedule to enable this as a proper scheduled job. It is
 * idempotent with the backstops above — flipToLive's conditional UPDATE means
 * only one caller ever wins a given room, so notifications can't duplicate.
 */

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const due = await db.select({ id: rooms.id }).from(rooms)
    .where(and(eq(rooms.status, 'scheduled'), lte(rooms.scheduledAt, new Date())));

  let wentLive = 0;
  for (const row of due) {
    const flipped = await flipToLive(row.id);
    if (!flipped) continue; // a viewer's lazy flip already claimed it
    wentLive++;
    await notifyRoomLive(flipped);
  }

  return NextResponse.json({ due: due.length, wentLive });
}
