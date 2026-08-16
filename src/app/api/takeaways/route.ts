import { auth } from '@clerk/nextjs/server';
import { getUserEmail } from '@/lib/clerk';
import { db } from '@/db';
import { takeaways, mentors, seekers, requests, rooms, queueEntries } from '@/db/schema';
import { eq, and, or, ne, lte, inArray, desc, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-handler';
import { mutationLimiter, privateReadLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { recordAbuseSignal } from '@/lib/abuse';
import { isUuid } from '@/lib/validate';
import {
  parseBullets, serializeBullets, splitBullets,
  requestIsWritable, roomIsWritable,
} from '@/lib/takeaways';

type Role = 'mentor' | 'seeker';

type TakeawayOut = {
  id: string;
  subjectSeekerClerkId: string | null;
  subjectName: string | null;
  bullets: string[];
  updatedAt: Date;
};

type SessionOut = {
  kind: 'request' | 'room' | 'archived';
  sessionId: string;
  sessionDate: Date;
  sessionLabel: string;
  role: Role;
  /**
   * Whether a new takeaway can still be written here. False for a session that
   * was cancelled or has not happened yet.
   *
   * Separate from whether the session appears at all, and the distinction is the
   * whole point: "can you write here?" and "do you have notes here?" are
   * different questions, and answering both with one filter is what made
   * cancelling a sip silently hide notes already written about it.
   */
  writable: boolean;
  /** Rooms the caller hosted only. Never sent to an attendee. */
  participants?: { clerkId: string; name: string }[];
  takeaways: TakeawayOut[];
};

const SESSION_LIMIT = 200;

function shape(row: typeof takeaways.$inferSelect): TakeawayOut {
  return {
    id: row.id,
    subjectSeekerClerkId: row.subjectSeekerClerkId,
    subjectName: row.subjectName,
    bullets: splitBullets(row.bullets),
    updatedAt: row.updatedAt,
  };
}

/**
 * A seeker's display name, preferring their profile over whatever the queue
 * recorded. Resolved server-side wherever a name is stored or shown, so a
 * takeaway cannot be filed under a name the caller made up — the same rule
 * POST /api/session-notes follows.
 */
function displayName(
  profile: { firstName: string | null; lastName: string | null } | undefined,
  fallback: string | null | undefined
): string {
  const fromProfile = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') : '';
  return fromProfile || fallback || 'Someone';
}

/**
 * Every session the caller may write a takeaway about, each carrying only the
 * takeaways they wrote themselves.
 *
 * There is no author parameter and no way to name someone else, so a caller can
 * only ever reach their own rows — the same defence GET /api/session-notes uses.
 * A mentor's takeaways and a seeker's takeaways on one session never meet here.
 *
 * Both roles are returned in one payload, tagged with the role the caller held,
 * because a user can be a mentor and a seeker at once. Each dashboard filters to
 * its own side.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success, reset } = await privateReadLimiter.limit(limitKey(req, userId));
    if (!success) return tooManyRequests(reset);

    const now = new Date();
    const mentorRow = await db.select({ id: mentors.id }).from(mentors).where(eq(mentors.clerkId, userId)).limit(1);
    const mentorId = mentorRow[0]?.id ?? null;
    const email = await getUserEmail(userId);

    const sessions: SessionOut[] = [];

    // Read first, so the filters below can tell "you cannot write here" from
    // "there is nothing here". A session the caller has already written about is
    // listed whether or not it still accepts writes — otherwise cancelling a sip
    // would strand every note taken on it: still in the table, reachable by
    // nothing, deletable by no one.
    const mine = await db.select().from(takeaways)
      .where(eq(takeaways.authorClerkId, userId))
      .orderBy(desc(takeaways.sessionDate))
      .limit(500);

    const writtenOnRequest = new Set(mine.map(t => t.requestId).filter(Boolean));
    const writtenOnRoom = new Set(mine.map(t => t.roomId).filter(Boolean));

    // --- 1:1s, as the mentor ---
    if (mentorId) {
      const rows = await db.select().from(requests)
        .where(and(eq(requests.mentorId, mentorId), eq(requests.status, 'accepted')))
        .orderBy(desc(requests.createdAt))
        .limit(SESSION_LIMIT);
      for (const r of rows) {
        const writable = requestIsWritable(r, now.getTime());
        if (!writable && !writtenOnRequest.has(r.id)) continue;
        sessions.push({
          kind: 'request', sessionId: r.id, role: 'mentor', writable,
          sessionDate: r.scheduledAt ?? r.respondedAt ?? r.createdAt,
          sessionLabel: r.seekerName,
          takeaways: [],
        });
      }
    }

    // --- 1:1s, as the seeker ---
    // Matched on Clerk id or email, because a seeker can be invited by email and
    // sign up later — the same pairing GET /api/my-sips uses.
    const seekerMatch = email
      ? or(eq(requests.seekerClerkId, userId), eq(requests.seekerEmail, email))
      : eq(requests.seekerClerkId, userId);
    const asSeeker = await db.select({
      request: requests,
      mentorFirstName: mentors.firstName,
      mentorLastName: mentors.lastName,
    })
      .from(requests)
      .leftJoin(mentors, eq(requests.mentorId, mentors.id))
      .where(and(seekerMatch, eq(requests.status, 'accepted')))
      .orderBy(desc(requests.createdAt))
      .limit(SESSION_LIMIT);
    for (const { request: r, mentorFirstName, mentorLastName } of asSeeker) {
      const writable = requestIsWritable(r, now.getTime());
      if (!writable && !writtenOnRequest.has(r.id)) continue;
      sessions.push({
        kind: 'request', sessionId: r.id, role: 'seeker', writable,
        sessionDate: r.scheduledAt ?? r.respondedAt ?? r.createdAt,
        sessionLabel: [mentorFirstName, mentorLastName].filter(Boolean).join(' ') || 'your mentor',
        takeaways: [],
      });
    }

    // --- Rooms, as the host ---
    const hostedRoomIds: string[] = [];
    if (mentorId) {
      const rows = await db.select().from(rooms)
        .where(and(eq(rooms.mentorId, mentorId), ne(rooms.status, 'scheduled'), lte(rooms.startedAt, now)))
        .orderBy(desc(rooms.startedAt))
        .limit(SESSION_LIMIT);
      for (const room of rows) {
        const writable = roomIsWritable(room, now.getTime());
        if (!writable && !writtenOnRoom.has(room.id)) continue;
        hostedRoomIds.push(room.id);
        sessions.push({
          kind: 'room', sessionId: room.id, role: 'mentor', writable,
          sessionDate: room.startedAt, sessionLabel: room.title,
          participants: [],
          takeaways: [],
        });
      }
    }

    // --- Rooms, as an attendee ---
    const attended = await db.select({ room: rooms })
      .from(queueEntries)
      .innerJoin(rooms, eq(queueEntries.roomId, rooms.id))
      .where(and(
        eq(queueEntries.seekerClerkId, userId),
        ne(rooms.status, 'scheduled'),
        lte(rooms.startedAt, now),
      ))
      .orderBy(desc(rooms.startedAt))
      .limit(SESSION_LIMIT);
    const seenAttended = new Set<string>();
    for (const { room } of attended) {
      // A seeker called back into the same room has several queue entries.
      if (seenAttended.has(room.id)) continue;
      seenAttended.add(room.id);
      const writable = roomIsWritable(room, now.getTime());
      if (!writable && !writtenOnRoom.has(room.id)) continue;
      sessions.push({
        kind: 'room', sessionId: room.id, role: 'seeker', writable,
        sessionDate: room.startedAt, sessionLabel: room.title,
        takeaways: [],
      });
    }

    // Who was in each hosted room, so the composer can offer one option per
    // person. Only for rooms the caller hosted: an attendee never receives the
    // guest list, and only a mentor gets the per-seeker option at all.
    if (hostedRoomIds.length > 0) {
      const entries = await db.select({
        roomId: queueEntries.roomId,
        seekerClerkId: queueEntries.seekerClerkId,
        queueName: queueEntries.seekerName,
        firstName: seekers.firstName,
        lastName: seekers.lastName,
      })
        .from(queueEntries)
        .leftJoin(seekers, eq(seekers.clerkId, queueEntries.seekerClerkId))
        .where(inArray(queueEntries.roomId, hostedRoomIds));

      const byRoom = new Map<string, Map<string, string>>();
      for (const e of entries) {
        if (!byRoom.has(e.roomId)) byRoom.set(e.roomId, new Map());
        byRoom.get(e.roomId)!.set(
          e.seekerClerkId,
          displayName({ firstName: e.firstName, lastName: e.lastName }, e.queueName)
        );
      }
      for (const s of sessions) {
        if (s.kind !== 'room' || s.role !== 'mentor') continue;
        const people = byRoom.get(s.sessionId);
        s.participants = people
          ? [...people.entries()]
              .map(([clerkId, name]) => ({ clerkId, name }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : [];
      }
    }

    // --- Attach the caller's own takeaways ---
    const byRequest = new Map<string, TakeawayOut[]>();
    const byRoom = new Map<string, TakeawayOut[]>();
    for (const t of mine) {
      if (t.requestId) {
        if (!byRequest.has(t.requestId)) byRequest.set(t.requestId, []);
        byRequest.get(t.requestId)!.push(shape(t));
      } else if (t.roomId) {
        if (!byRoom.has(t.roomId)) byRoom.set(t.roomId, []);
        byRoom.get(t.roomId)!.push(shape(t));
      } else {
        // Parent gone. The FKs are ON DELETE SET NULL precisely so a personal
        // note outlives the session it was about, so it is surfaced on its own
        // rather than silently dropped — the denormalised label and date are
        // what make that possible.
        sessions.push({
          kind: 'archived', sessionId: t.id, role: t.authorRole as Role,
          // Nothing left to write against, but still readable and deletable.
          writable: false,
          sessionDate: t.sessionDate, sessionLabel: t.sessionLabel,
          takeaways: [shape(t)],
        });
      }
    }

    for (const s of sessions) {
      if (s.kind === 'request') s.takeaways = byRequest.get(s.sessionId) ?? [];
      else if (s.kind === 'room') s.takeaways = byRoom.get(s.sessionId) ?? [];
    }

    // The group note first, then per-person notes by name, so a room reads the
    // same way every load.
    for (const s of sessions) {
      s.takeaways.sort((a, b) => {
        if (!a.subjectSeekerClerkId) return -1;
        if (!b.subjectSeekerClerkId) return 1;
        return (a.subjectName ?? '').localeCompare(b.subjectName ?? '');
      });
    }

    sessions.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
    return NextResponse.json(sessions);
  } catch (err) {
    return handleApiError(err, 'GET /api/takeaways');
  }
}

/**
 * Write or replace one takeaway.
 *
 * Upsert rather than insert-or-error: the composer is an editor, and the unique
 * indexes make a re-save land on the same row instead of stacking duplicates.
 * Which index it targets depends on the shape of the write, so the predicate is
 * supplied alongside the target — Postgres can only infer a partial unique index
 * when it is given the matching WHERE.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { success } = await mutationLimiter.limit(userId);
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down a bit.' }, { status: 429 });

    const { requestId, roomId, subjectSeekerClerkId, bullets } = await req.json();

    if (!!requestId === !!roomId) {
      return NextResponse.json({ error: 'Name exactly one session.' }, { status: 400 });
    }
    if (requestId && !isUuid(requestId)) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (roomId && !isUuid(roomId)) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (subjectSeekerClerkId != null && (typeof subjectSeekerClerkId !== 'string' || !subjectSeekerClerkId.trim())) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const lines = parseBullets(bullets);
    if (!lines) return NextResponse.json({ error: 'Write 1 to 3 short bullets, 200 characters each.' }, { status: 400 });

    const mentorRow = await db.select().from(mentors).where(eq(mentors.clerkId, userId)).limit(1);
    const mentor = mentorRow[0] ?? null;

    let role: Role;
    let sessionLabel: string;
    let sessionDate: Date;
    let subjectName: string | null = null;

    if (requestId) {
      if (subjectSeekerClerkId) {
        return NextResponse.json({ error: 'Per-person takeaways are only for live sessions.' }, { status: 400 });
      }

      const found = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
      const r = found[0];
      if (!r) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

      if (mentor && r.mentorId === mentor.id) {
        role = 'mentor';
        sessionLabel = r.seekerName;
      } else {
        const email = await getUserEmail(userId);
        const isSeeker = r.seekerClerkId === userId || (!!email && r.seekerEmail === email);
        if (!isSeeker) {
          void recordAbuseSignal('auth_denied', userId, { route: 'takeaways.write', requestId });
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        role = 'seeker';
        const owner = await db.select({ firstName: mentors.firstName, lastName: mentors.lastName })
          .from(mentors).where(eq(mentors.id, r.mentorId)).limit(1);
        sessionLabel = owner[0]
          ? [owner[0].firstName, owner[0].lastName].filter(Boolean).join(' ')
          : 'your mentor';
      }

      if (!requestIsWritable(r)) {
        return NextResponse.json({ error: 'You can add takeaways once the sip has happened.' }, { status: 400 });
      }
      sessionDate = r.scheduledAt ?? r.respondedAt ?? r.createdAt;
    } else {
      const found = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
      const room = found[0];
      if (!room) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

      if (mentor && room.mentorId === mentor.id) {
        role = 'mentor';
      } else {
        // Same gate as POST /api/session-notes and POST connect-request: only
        // people who actually turned up in the room can act on it.
        const wasThere = await db.select({ id: queueEntries.id }).from(queueEntries)
          .where(and(eq(queueEntries.roomId, roomId), eq(queueEntries.seekerClerkId, userId)))
          .limit(1);
        if (wasThere.length === 0) {
          void recordAbuseSignal('auth_denied', userId, { route: 'takeaways.write', roomId });
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        role = 'seeker';
      }

      if (!roomIsWritable(room)) {
        return NextResponse.json({ error: 'That session has not started yet.' }, { status: 400 });
      }
      sessionLabel = room.title;
      sessionDate = room.startedAt;

      if (subjectSeekerClerkId) {
        // Only the host splits a room up per person. A seeker has one mentor in
        // the room, so there is nothing for them to choose between, and letting
        // them send a subject would file a note against another attendee.
        if (role !== 'mentor') {
          return NextResponse.json({ error: 'Only the host can write per-person takeaways.' }, { status: 403 });
        }
        const entry = await db.select({ seekerName: queueEntries.seekerName }).from(queueEntries)
          .where(and(eq(queueEntries.roomId, roomId), eq(queueEntries.seekerClerkId, subjectSeekerClerkId)))
          .limit(1);
        if (entry.length === 0) {
          return NextResponse.json({ error: 'That person was not in this session.' }, { status: 403 });
        }
        const profile = await db.select({ firstName: seekers.firstName, lastName: seekers.lastName })
          .from(seekers).where(eq(seekers.clerkId, subjectSeekerClerkId)).limit(1);
        subjectName = displayName(profile[0], entry[0].seekerName);
      }
    }

    // A ban is checked on whichever side the caller is actually acting as. The
    // mentor row is known to exist on that path, because ownership was matched
    // through it. On the seeker path a missing seekers row is tolerated: a
    // request can be raised by email long before the person signs up, and they
    // should not lose their own notes over it. That does not reopen the hole
    // @/lib/guards describes, because eligibility here is already proven by the
    // session itself — nothing new can be created from this route.
    if (role === 'mentor') {
      if (mentor!.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
    } else {
      const profile = await db.select({ banned: seekers.banned }).from(seekers)
        .where(eq(seekers.clerkId, userId)).limit(1);
      if (profile[0]?.banned) return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
    }

    const values = {
      requestId: requestId ?? null,
      roomId: roomId ?? null,
      authorClerkId: userId,
      authorRole: role,
      subjectSeekerClerkId: subjectSeekerClerkId ?? null,
      subjectName,
      bullets: serializeBullets(lines),
      sessionLabel,
      sessionDate,
    };
    const set = {
      bullets: values.bullets,
      sessionLabel,
      subjectName,
      sessionDate,
      updatedAt: new Date(),
    };

    // Each branch names the partial index that governs its shape. The predicate
    // is repeated verbatim from the index definition in @/db/schema, because
    // Postgres only infers a partial unique index when the ON CONFLICT predicate
    // matches it — an equivalent-but-differently-written one is not enough.
    const target = requestId
      ? {
          target: [takeaways.authorClerkId, takeaways.requestId],
          targetWhere: sql`request_id is not null`,
        }
      : subjectSeekerClerkId
        ? {
            target: [takeaways.authorClerkId, takeaways.roomId, takeaways.subjectSeekerClerkId],
            targetWhere: sql`room_id is not null and subject_seeker_clerk_id is not null`,
          }
        : {
            target: [takeaways.authorClerkId, takeaways.roomId],
            targetWhere: sql`room_id is not null and subject_seeker_clerk_id is null`,
          };

    const saved = await db.insert(takeaways).values(values)
      .onConflictDoUpdate({ ...target, set })
      .returning();

    return NextResponse.json(shape(saved[0]));
  } catch (err) {
    return handleApiError(err, 'POST /api/takeaways');
  }
}
