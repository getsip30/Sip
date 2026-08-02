import { timingSafeEqual } from 'node:crypto';

/**
 * Authorises a scheduled job request.
 *
 * The previous check compared against `Bearer ${process.env.CRON_SECRET}`
 * directly. If the variable were ever unset the expected value became the
 * literal "Bearer undefined", which anyone could send. validateEnv already
 * refuses to boot without it, but an auth check should not depend on a
 * different module having run first, and these endpoints send mail and mutate
 * rows against production data.
 *
 * Compared in constant time so the secret cannot be recovered a byte at a time.
 */
export function isAuthorisedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get('authorization');
  if (!header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}
