/**
 * Database connection module.
 *
 * DEMO_MODE=true: Uses in-memory Maps (no PostgreSQL required).
 * Otherwise: Uses PostgreSQL via postgres.js + Drizzle ORM.
 *
 * Schema creation is handled by Drizzle Kit (`drizzle-kit push`) — not by
 * auto-migration at runtime. This is intentional: schema changes are applied
 * explicitly during development or deployment, keeping the runtime startup
 * fast and predictable.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

// sql needs a minimal interface for health checks + graceful shutdown
interface SqlConnection {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
  end: () => Promise<void>;
}

let db: PostgresJsDatabase<typeof schema>;
let sql: SqlConnection;

if (process.env.DEMO_MODE === 'true') {
  // In-memory adapter — no PostgreSQL required
  const { createMemoryDb, createNoOpSql } = await import('./memory-adapter.js');
  const memDb = createMemoryDb();
  db = memDb.db as unknown as PostgresJsDatabase<typeof schema>;
  sql = createNoOpSql();
} else {
  // PostgreSQL via postgres.js + Drizzle ORM
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString && process.env.NODE_ENV !== 'test') {
    throw new Error('DATABASE_URL environment variable must be set');
  }

  const pgSql = postgres(connectionString ?? 'postgres://localhost:5432/adtraffic_test', {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  db = drizzle(pgSql, { schema });
  sql = pgSql as unknown as SqlConnection;
}

export { db, sql, schema };
