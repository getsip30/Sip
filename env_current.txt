const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'DATABASE_URL',
  'GROQ_API_KEY',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'CRON_SECRET',
  'ADMIN_EMAIL',
] as const;

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Check .env.local against .env.example.`
    );
  }
}
