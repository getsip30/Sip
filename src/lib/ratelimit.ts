import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { recordAbuseSignal } from '@/lib/abuse';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const emailLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 m'),
  prefix: 'sip-email',
});

export const mutationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '10 m'),
  prefix: 'sip-mutation',
});

export const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'sip-read',
});

export function getIp(req: Request): string {
  const vercelForwarded = req.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) return vercelForwarded.split(',')[0].trim();
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}

/**
 * Prefer the signed-in user as the bucket key, falling back to IP.
 *
 * Keying reads purely on IP punishes shared egress: a school or campus network
 * puts thousands of legitimate users behind one address, and they would 429 each
 * other. An authenticated user gets their own budget.
 */
export function limitKey(req: Request, userId?: string | null): string {
  return userId ? `u:${userId}` : `ip:${getIp(req)}`;
}

/** Reads that are cheap but scrapeable in bulk. */
export const publicReadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 m'),
  prefix: 'sip-public-read',
  analytics: true,
});

/** Reads that fan out into several queries, or return personal data. */
export const privateReadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(90, '1 m'),
  prefix: 'sip-private-read',
  analytics: true,
});

/** Admin dashboard polls its own endpoints on a timer. */
export const adminLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 m'),
  prefix: 'sip-admin',
});

/**
 * 429 response with a Retry-After the client can honour.
 *
 * Pass `actor` to feed the abuse counters: someone repeatedly burning through
 * limiters is the signal that separates a busy user from a scraper.
 */
export function tooManyRequests(reset?: number, actor?: string) {
  if (actor) void recordAbuseSignal('rate_limited', actor);
  const seconds = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 1000)) : 60;
  return NextResponse.json(
    { error: 'Too many requests. Slow down a bit.' },
    { status: 429, headers: { 'Retry-After': String(seconds) } }
  );
}