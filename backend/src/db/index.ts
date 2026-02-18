/**
 * Database connection module.
 *
 * Schema creation is handled by Drizzle Kit (`drizzle-kit push`) — not by
 * auto-migration at runtime. This is intentional: schema changes are applied
 * explicitly during development or deployment, keeping the runtime startup
 * fast and predictable.
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV !== 'test') {
  throw new Error('DATABASE_URL environment variable must be set');
}

/** PostgreSQL connection pool — exported for graceful shutdown */
export const sql = postgres(connectionString ?? 'postgres://localhost:5432/adtraffic_test', {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql, { schema });

export { schema };
