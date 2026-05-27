import { logger } from "../utils/logger";
/**
 * server/db/index.ts
 * Drizzle ORM + node-postgres connection for R3 v4.
 *
 * Uses the pg pool configured from DATABASE_URL (Railway injects this).
 * Exports a single `db` instance used by all routers and procedures.
 *
 * Connection pool sizing:
 *   - max: 10 (safe default for Railway's free/hobby tiers)
 *   - idleTimeoutMillis: 30s
 *   - connectionTimeoutMillis: 5s
 *
 * Usage:
 *   import { db } from '../db';
 *   const rows = await db.select().from(users).where(eq(users.id, ctx.user.id));
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool }    from 'pg';
import * as schema from '../../shared/schema';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    '[R3 v4] DATABASE_URL environment variable is not set. ' +
    'Set it in Railway or your .env file.',
  );
}

const pool = new Pool({
  connectionString:      DATABASE_URL,
  max:                   10,
  idleTimeoutMillis:     30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === 'false'
    ? false
    : { rejectUnauthorized: false },  // Railway PostgreSQL requires SSL
});

// Fail fast if pool cannot connect on startup
pool.on('error', (err) => {
  logger.error('Unexpected pool error', { message: err.message });
});

export const db = drizzle(pool, { schema });
export type DB  = typeof db;