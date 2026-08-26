import { db } from '@/db';
import { emailLogs } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';

/**
 * The Notification Center's feed: the twenty most recent sends.
 *
 * This is not every email Sip sends. Only routes that go through `sendAndLog`
 * are recorded, which today is the admin broadcast and nothing else — the
 * transactional mail (accepts, declines, reminders, nudges, asks) still sends
 * directly through the mailer and leaves no row. The UI says so rather than
 * letting an empty list read as "no mail was sent".
 */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const rows = await db
      .select({
        id: emailLogs.id,
        recipientEmail: emailLogs.recipientEmail,
        subject: emailLogs.subject,
        emailType: emailLogs.emailType,
        audience: emailLogs.audience,
        status: emailLogs.status,
        errorMessage: emailLogs.errorMessage,
        sentAt: emailLogs.sentAt,
      })
      .from(emailLogs)
      .orderBy(desc(emailLogs.sentAt))
      .limit(20);

    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err, 'GET /api/admin/dashboard/notifications');
  }
}
