import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

/**
 * neon-http is the right driver here: each query is a stateless HTTP request, so
 * there is no connection to hold open or pool per invocation, which is what a
 * serverless runtime needs. The one thing that does matter is that the host is
 * the PgBouncer endpoint, otherwise every concurrent query consumes a real
 * Postgres backend and the instance hits max_connections under load.
 */
if (process.env.NODE_ENV === 'production' && !url.includes('-pooler.')) {
  console.warn(
    JSON.stringify({
      level: 'warn',
      event: 'db.non_pooled_connection_string',
      message:
        'DATABASE_URL does not point at a -pooler host. Under concurrent load this can exhaust Postgres connections. Use the Neon pooled connection string.',
    })
  );
}

const sql = neon(url);
export const db = drizzle(sql, { schema });
