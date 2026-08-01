import { logError } from '@/lib/logger';

export class ExternalTimeoutError extends Error {
  constructor(service: string, ms: number) {
    super(`${service} did not respond within ${ms}ms`);
    this.name = 'ExternalTimeoutError';
  }
}

/**
 * Bound any promise in time. Third-party SDKs (Clerk, Resend) don't all accept
 * an AbortSignal, and an unbounded await on one of them holds a serverless
 * invocation open until the platform kills it, which is how a single slow
 * dependency turns into exhausted concurrency across the whole app.
 */
export function withTimeout<T>(service: string, ms: number, work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ExternalTimeoutError(service, ms)), ms);
    work.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/** fetch with an abort-based timeout. */
export async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Retry with exponential backoff and jitter. Only retries transport errors,
 * timeouts, and retryable status codes; a 4xx that won't change on replay is
 * returned immediately so we don't burn the caller's budget.
 */
export async function withRetry<T>(
  service: string,
  work: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; isRetryable?: (r: T) => boolean } = {}
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 250;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await work();
      if (attempt < attempts && opts.isRetryable?.(result)) {
        await sleep(backoff(base, attempt));
        continue;
      }
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt === attempts) break;
      await sleep(backoff(base, attempt));
    }
  }

  logError('external.retries_exhausted', lastErr, { service, attempts });
  throw lastErr;
}

export function isRetryableResponse(r: Response) {
  return RETRYABLE_STATUS.has(r.status);
}

function backoff(base: number, attempt: number) {
  const exponential = base * 2 ** (attempt - 1);
  return exponential + Math.random() * base;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
