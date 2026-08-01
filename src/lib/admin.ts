import { auth } from '@clerk/nextjs/server';
import { getUserEmail } from '@/lib/clerk';

export async function isAdmin() {
  if (!process.env.ADMIN_EMAIL) return false;
  const { userId } = await auth();
  if (!userId) return false;
  const email = await getUserEmail(userId);
  if (!email) return false;
  return email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
}