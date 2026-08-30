# `scheduled_at` timezone drift — follow-up list

Companion to the change that added `scheduled_at_timezone` and made every
**display** of a scheduled time render in the booker's zone.

**Status: closed.** Three of the four were fixed as their own change, separately
from the display work that produced this list. The fourth was reviewed and
deliberately left as it is. Nothing here is outstanding.

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

## Fixed

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

**Fixed.** Both sides are now reduced to a date inside the sip's own zone, so
"tomorrow" means what the seeker means by it. The zone is resolved through a
`LEFT JOIN pg_timezone_names` rather than fed straight to `AT TIME ZONE`: an
unrecognised name would raise and take down the entire nightly run, and one bad
row should not cost everyone else their reminder. Unrecognised degrades to UTC,
which is where rows without a zone already sit.

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

**Wrong outcome:** all reminders stop, silently, with no signal.

**Fixed.** The comparisons go through a `STARTS_AT` fragment —
`(r.scheduled_at AT TIME ZONE 'UTC')` — which names the zone the stored value is
actually in and yields a `timestamptz`. The windows no longer depend on a
setting. The same pinning was applied to the `scheduled_at < now()` sweep in the
reminders cron, which had the identical exposure.

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

**Fixed.** Each booking's day is now taken in its own zone via
`scheduledDayKey`. Verified at both boundaries: 11:30pm → 12:30am in New York
reads as a day change, and 7pm → 9pm in New York does not, even though the
latter crosses a UTC midnight and previously could have.

### 4. `src/app/dashboard/page.tsx:301` — session-note day grouping

```ts
const day = new Date(n.sessionDate).toLocaleDateString('en-CA');
```

Groups notes into days in the **viewer's** zone, so a mentor travelling sees
their own history re-bucket, and notes near midnight land under the wrong
heading.

**Decision: left viewer-local. Closed, not deferred.**

There is no session zone to use here, which is what separates this from the
other three. `session_notes.session_date` is copied from `rooms.started_at` —
when a live room actually began, not a time anyone booked. A room can go live
having never been scheduled, so `rooms.scheduled_at_timezone` is null for many
of these rows, and where it is set it describes the zone of a *scheduled* time
rather than the start time in hand.

The two alternatives were both worse:

- **A `mentors.timezone` column.** Semantically the best answer — these are one
  mentor's private notes and they are the only reader — but it buys a migration
  and a new piece of profile state to keep current, for an accordion heading.
- **UTC.** Consistent with the rest of this work and stable across devices, but
  it moves the day boundary off the mentor's real day, which is the entire
  purpose of grouping by day. Consistency would have cost the feature its point.

Viewer-local is wrong only when the mentor changes zone, and then only for notes
near midnight. The heading rendered from this key is a bare date carrying no
zone label, so nobody is being told anything false — the notes are merely
grouped on a boundary the reader may not share, which is a fair price for not
adding a column.

This is the one place in the codebase where a time is deliberately shown in the
viewer's zone rather than a stored one. That is intentional, and it is not a
counterexample to the rule the rest of this change establishes: everywhere a
time was *chosen by someone*, it renders in the zone they chose it in. Nobody
chose this one.

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

## What is left

Nothing. Three fixed and verified, one reviewed and deliberately left alone.
