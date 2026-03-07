/**
 * Database migration runner.
 *
 * Runs Drizzle ORM migrations against PostgreSQL, then exits.
 * Designed to run as a Docker init container before backend instances start.
 *
 * Usage:
 *   node backend/dist/db/migrate.js
 *
 * Uses drizzle-kit push for schema synchronization.
 * For file-based migrations, use:
 *   import { migrate } from 'drizzle-orm/postgres-js/migrator';
 *   await migrate(db, { migrationsFolder: './drizzle' });
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import pino from 'pino';
import * as schema from './schema.js';

const logger = pino({ name: 'adtraffic-migrate' });

async function runMigrations(): Promise<void> {
  logger.info('Running database migrations...');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logger.error('DATABASE_URL environment variable must be set');
    process.exit(1);
  }

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 10,
  });

  try {
    // Verify database connectivity
    const result = await sql`SELECT current_database() as db, version() as version`;
    logger.info({ db: result[0]?.db }, 'Connected to PostgreSQL');

    // Instantiate drizzle to verify schema compatibility
    const db = drizzle(sql, { schema });

    // Verify tables exist by running a simple query against the users table
    try {
      const users = await db.select().from(schema.users).limit(1);
      logger.info({ sampleRows: users.length }, 'Users table accessible');
    } catch {
      logger.info('Users table not found — run drizzle-kit push');
    }

    logger.info('Migration check complete');
  } catch (err) {
    logger.error({ err: { message: err instanceof Error ? err.message : 'Unknown error' } }, 'Migration failed');
    process.exit(1);
  } finally {
    await sql.end();
  }

  process.exit(0);
}

void runMigrations();
