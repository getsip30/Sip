import { db } from '@/db';
import { siteFeedback } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { adminLimiter, limitKey, tooManyRequests } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/api-handler';
import { isAdmin } from '@/lib/admin';

export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { success, reset } = await adminLimiter.limit(limitKey(req, 'admin'));
    if (!success) return tooManyRequests(reset);

    const result = await db.select().from(siteFeedback).orderBy(desc(siteFeedback.createdAt));
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'GET /api/admin/site-feedback');
  }
}