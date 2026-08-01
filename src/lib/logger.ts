import * as Sentry from '@sentry/nextjs';

type Fields = Record<string, unknown>;

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
  emit('error', event, {
    ...fields,
    message: error?.message ?? String(err),
    errorName: error?.name,
    stack: error?.stack,
  });
  Sentry.captureException(err, { tags: { event, ...stringTags(fields) } });
}

/**
 * A failure that is deliberately swallowed so it can't fail the request, but
 * that must still be visible. Use anywhere a `.catch` would otherwise end the
 * story, so a broken integration doesn't just quietly stop working.
 */
export function logSwallowed(event: string, err: unknown, fields: Fields = {}) {
  const error = err instanceof Error ? err : undefined;
  emit('warn', event, {
    ...fields,
    swallowed: true,
    message: error?.message ?? String(err),
    errorName: error?.name,
  });
  Sentry.captureException(err, {
    level: 'warning',
    tags: { event, swallowed: 'true', ...stringTags(fields) },
  });
}

function stringTags(fields: Fields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
  }
  return out;
}
