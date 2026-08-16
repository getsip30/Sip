import * as Sentry from '@sentry/nextjs';

type Fields = Record<string, unknown>;

/**
 * Driver-level fields worth keeping off a thrown error.
 *
 * These are what node-postgres and Neon hang on their error objects, and they
 * are the difference between "a query failed" and "this exact constraint on
 * this exact table rejected this exact value".
 *
 * `detail` embeds the offending value verbatim ("Key (email)=(x@y.z) already
 * exists"), so it is personal data. It is kept anyway: drizzle's own wrapper
 * message already logs the bound parameters, so redacting it here would narrow
 * nothing while removing the single most useful line in the log.
 */
const DRIVER_FIELDS = ['code', 'severity', 'detail', 'constraint', 'table', 'column', 'schema', 'routine', 'hint'] as const;

/** Deep enough for wrapper→driver, with room to spare; short enough to be safe. */
const MAX_CAUSE_DEPTH = 4;

function driverFields(err: unknown): Fields {
  const out: Fields = {};
  if (!err || typeof err !== 'object') return out;
  const e = err as Record<string, unknown>;
  for (const field of DRIVER_FIELDS) {
    const value = e[field];
    if (value !== undefined && value !== null) out[field] = String(value);
  }
  return out;
}

/**
 * The `err.cause` chain, flattened.
 *
 * Drizzle throws an Error whose message is only the failed SQL and its bound
 * parameters; the Postgres error — code, constraint, detail — is on `cause`.
 * Logging `message` alone therefore records that a query failed while dropping
 * every fact about why, which is exactly how a unique-violation reaches a log as
 * an unexplained 500.
 *
 * Depth-capped and cycle-guarded: a `cause` chain is arbitrary user data and
 * nothing stops it pointing at itself.
 */
function causeChain(err: unknown): Fields[] {
  const chain: Fields[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err instanceof Error ? err.cause : undefined;

  while (current != null && chain.length < MAX_CAUSE_DEPTH) {
    if (seen.has(current)) break;
    seen.add(current);
    chain.push({
      message: current instanceof Error ? current.message : String(current),
      errorName: current instanceof Error ? current.name : typeof current,
      ...driverFields(current),
    });
    current = current instanceof Error ? current.cause : undefined;
  }

  return chain;
}

/**
 * Single-line JSON to stdout so Vercel's log search can filter on fields rather
 * than substring-matching free text. Every entry carries `event`, so a class of
 * failure can be found without knowing the message wording.
 */
function emit(level: 'info' | 'warn' | 'error', event: string, fields: Fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function logInfo(event: string, fields: Fields = {}) {
  emit('info', event, fields);
}

export function logWarn(event: string, fields: Fields = {}) {
  emit('warn', event, fields);
}

export function logError(event: string, err: unknown, fields: Fields = {}) {
  const error = err instanceof Error ? err : undefined;
  const cause = causeChain(err);
  emit('error', event, {
    ...fields,
    message: error?.message ?? String(err),
    errorName: error?.name,
    // Driver fields from the thrown error itself, for the case where it IS the
    // driver error rather than a wrapper around one.
    ...driverFields(err),
    ...(cause.length ? { cause } : {}),
    stack: error?.stack,
  });
  Sentry.captureException(err, {
    tags: { event, ...stringTags(fields) },
    ...(cause.length ? { extra: { cause } } : {}),
  });
}

/**
 * A failure that is deliberately swallowed so it can't fail the request, but
 * that must still be visible. Use anywhere a `.catch` would otherwise end the
 * story, so a broken integration doesn't just quietly stop working.
 */
export function logSwallowed(event: string, err: unknown, fields: Fields = {}) {
  const error = err instanceof Error ? err : undefined;
  const cause = causeChain(err);
  emit('warn', event, {
    ...fields,
    swallowed: true,
    message: error?.message ?? String(err),
    errorName: error?.name,
    ...driverFields(err),
    ...(cause.length ? { cause } : {}),
  });
  Sentry.captureException(err, {
    level: 'warning',
    tags: { event, swallowed: 'true', ...stringTags(fields) },
    ...(cause.length ? { extra: { cause } } : {}),
  });
}

function stringTags(fields: Fields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
  }
  return out;
}
