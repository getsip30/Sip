# `scheduled_at` timezone drift — follow-up list

Companion to the change that added `scheduled_at_timezone` and made every
**display** of a scheduled time render in the booker's zone.

**Nothing in this document was changed by that work, and nothing here should be
changed without its own review.** This is the list of places where the *timing
logic* around `scheduled_at` can still reach a wrong answer, written down while
the code was fresh so the next pass does not have to rediscover it.

## The underlying shape

`scheduled_at` is `timestamp` **without** time zone. Drizzle writes
`date.toISOString()` into it, so the stored wall clock is the *UTC* wall clock
of the true instant, and reads it back as `value + '+0000'`. Round-tripping
through Drizzle is therefore faithful: the instant that goes in is the instant
that comes out.

Two things still go wrong on top of that:

1. **Mixed comparisons depend on the Postgres session `TimeZone`.** When a raw
   query compares the naive `scheduled_at` against `now()` (a `timestamptz`),
   Postgres casts the naive side using the session zone. Neon's default is UTC,
   which is the only reason these are right today. They are correct by
   configuration, not by construction, and nothing in the codebase asserts it.

2. **"Which day is it" was never answerable.** Any question of the form *has
   the date changed* or *is this tomorrow* needs a zone to be meaningful, and
   until now there wasn't one stored. These sites answered in the server's zone
   or in UTC, which is not the calendar the person booking is looking at.
   `scheduled_at_timezone` makes the right answer computable for the first
   time — that is what makes this list actionable rather than theoretical.

## Sites that can make a wrong decision

### 1. `src/app/api/cron/reminders/route.ts:29` — "your sip is tomorrow" email

```sql
AND r.scheduled_at::date = (now() + interval '1 day')::date
```

Both sides are reduced to a date, and neither uses the seeker's zone. A seeker
in Los Angeles who books 8:00 PM on Oct 3 is stored as Oct 4 03:00 UTC, so this
matches them on the calendar day *before* the one they would call "tomorrow" —
the email arrives roughly two days ahead of a sip they think is tomorrow. The
further west the seeker, and the later in the evening the sip, the worse it
gets; sips booked before ~4 PM Pacific are unaffected.

**Wrong outcome:** reminder email a day early (or, for zones east of UTC with
early-morning sips, a day late).

### 2. `src/lib/reminders.ts:96-135` — the 24h / 1h / 10m / reflection windows

```sql
AND r.scheduled_at > now() + interval '23 hours 30 minutes'
AND r.scheduled_at <= now() + interval '24 hours'
```

These are genuinely instant-based and correct **while the session zone is UTC**.
If it is ever not — a Neon setting change, a different host, a pooler with its
own default, a local `psql` running the same query — every window shifts by the
offset. The windows are 30 minutes wide and the offsets are whole hours, so the
failure mode is not a late reminder but a *silent total miss*: the query matches
nothing, no reminder is ever sent, and no error is raised.

**Wrong outcome:** all reminders stop, silently, with no signal. Worth a
`SET TimeZone` or an explicit `AT TIME ZONE 'UTC'` regardless of the rest of
this list — it is the cheapest fix here and the highest-consequence failure.

### 3. `src/app/api/requests/[id]/schedule/route.ts:53-54` — "did the day change"

```ts
const previous = r.scheduledAt ? new Date(r.scheduledAt) : null;
const dayChanged = !previous || previous.toDateString() !== new Date(scheduledAt).toDateString();
```

`toDateString()` reads the **server's** zone. This decides whether
`reminderSentAt` is cleared, which decides whether the mentor's reminder can
fire again. A seeker rescheduling across midnight *in their own zone* may not
register as a day change, and a seeker rescheduling within a single one of
their days may register as one.

**Wrong outcome:** either a mentor reminder that never re-sends for a sip that
genuinely moved to another day, or a duplicate reminder for one that didn't.
Now fixable: compare the two instants formatted in `scheduled_at_timezone`.

### 4. `src/app/dashboard/page.tsx:301` — session-note day grouping

```ts
const day = new Date(n.sessionDate).toLocaleDateString('en-CA');
```

Groups notes into days in the **viewer's** zone, so a mentor travelling sees
their own history re-bucket, and notes near midnight land under the wrong
heading. Cosmetic rather than a wrong decision, but it is the same bug as the
rest and belongs in the same pass.

## Sites that are fine — checked, no change needed

Recorded so the next pass does not re-audit them:

- `src/lib/no-show.ts` (`isWithinNoShowWindow`, `noShowWindowClosesAt`,
  `cancellationStatus`) — pure arithmetic on the instant. Zone-independent.
- `src/lib/reflections.ts` (`reflectionOpensAt`, `isReflectionOpen`) — same.
- `src/lib/takeaways.ts` (`requestIsWritable`, `roomIsWritable`) — same.
- `src/lib/rooms.ts:62`, `src/app/api/cron/go-live/route.ts:31`,
  `src/app/api/rooms/route.ts:30`, `src/app/api/rooms/upcoming/route.ts:25` —
  Drizzle binds `new Date()` as a naive UTC wall clock and compares it against a
  naive UTC column. Correct, and unlike the raw SQL above, correct *regardless*
  of the session zone.
- `src/lib/attendance.ts`, `src/lib/nudges.ts` — `IS NULL` / `IS NOT NULL` only.
- The 30-minute overlap check in
  `src/app/api/requests/[id]/schedule/route.ts:39-45` — instant arithmetic.

## Suggested order

(2) first and on its own — it is a one-line guard against a silent, total
failure. Then (1) and (3), which now have the data they need. (4) whenever the
dashboard is next open.
