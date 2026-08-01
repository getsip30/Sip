import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import { ExternalTimeoutError } from '@/lib/external';

/**
 * Emits a structured, searchable record and returns a generic body.
 *
 * `errorId` is echoed to the client so a user-reported problem can be found in
 * logs directly, without having to guess from a timestamp.
 */
export function handleApiError(err: unknown, context: string, fields: Record<string, unknown> = {}) {
  const errorId = crypto.randomUUID();
  logError('api.unhandled_error', err, { route: context, errorId, ...fields });

  // A dependency timing out is upstream unavailability, not a bug in this route.
  // Returning 503 lets clients and uptime checks tell the two apart.
  if (err instanceof ExternalTimeoutError) {
    return NextResponse.json(
      { error: 'A service we depend on is slow right now. Please try again shortly.', errorId },
      { status: 503, headers: { 'Retry-After': '15' } }
    );
  }

  return NextResponse.json({ error: 'Something went wrong. Please try again.', errorId }, { status: 500 });
}