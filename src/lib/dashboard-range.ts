/** Default window for the dashboard when no range is given. */
export const DEFAULT_RANGE_DAYS = 7;

/** Widest window the dashboard will query, so a hand-edited URL cannot ask for
 *  a full table scan of every event ever recorded. */
const MAX_RANGE_DAYS = 365;

export type DateRange = { from: Date; to: Date; days: number };

/**
 * Read `?from=&to=` (ISO dates) off a request, falling back to the last seven
 * days. `?days=N` is accepted as the shorthand the UI's range selector uses.
 *
 * `to` is exclusive and pushed to the end of its day when a bare date is given,
 * so "1st to the 7th" includes everything that happened on the 7th rather than
 * stopping at midnight — the off-by-one that makes a dashboard quietly
 * under-report its most recent day.
 */
export function parseRange(url: URL): DateRange {
  const now = new Date();
  const daysParam = Number(url.searchParams.get('days'));
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  if (fromParam || toParam) {
    const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - DEFAULT_RANGE_DAYS * 86400_000);
    let to = toParam ? new Date(toParam) : now;

    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      // A bare 'YYYY-MM-DD' parses to midnight UTC; treat it as the whole day.
      if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
        to = new Date(to.getTime() + 86400_000);
      }
      if (to > from) {
        const span = Math.min((to.getTime() - from.getTime()) / 86400_000, MAX_RANGE_DAYS);
        return { from: new Date(to.getTime() - span * 86400_000), to, days: Math.round(span) };
      }
    }
  }

  const days = Number.isFinite(daysParam) && daysParam > 0
    ? Math.min(Math.floor(daysParam), MAX_RANGE_DAYS)
    : DEFAULT_RANGE_DAYS;

  return { from: new Date(now.getTime() - days * 86400_000), to: now, days };
}
