import { db } from '@/db';
import { mentors, seekers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function generateUniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    const [existingMentor, existingSeeker] = await Promise.all([
      db.select({ id: mentors.id }).from(mentors).where(eq(mentors.referralCode, code)),
      db.select({ id: seekers.id }).from(seekers).where(eq(seekers.referralCode, code)),
    ]);
    if (existingMentor.length === 0 && existingSeeker.length === 0) return code;
  }
  return `${generateReferralCode()}${Date.now().toString(36).slice(-4)}`.toUpperCase();
}