/**
 * Database migration runner.
 *
 * Applies pending Drizzle migrations from backend/drizzle against PostgreSQL,
 * then exits. Runs as a Docker init container before the backend starts.
 *
 * Usage: node backend/dist/db/migrate.js
 * After changing src/db/schema.ts, generate a migration:
 *   npm run db:generate --workspace=backend
 */

import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import pino from 'pino';

const logger = pino({ name: 'adtraffic-migrate' });

// Migrations are shipped in backend/drizzle, resolved relative to this module so
// the path holds whether run from source (tsx) or the compiled dist/ output.
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

async function runMigrations(): Promise<void> {
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
    const db = drizzle(sql);
    logger.info({ migrationsFolder }, 'Applying database migrations...');
    await migrate(db, { migrationsFolder });
    logger.info('Migrations applied');
  } catch (err) {
    logger.error(
      { err: { message: err instanceof Error ? err.message : 'Unknown error' } },
      'Migration failed',
    );
    await sql.end();
    process.exit(1);
  }

  await sql.end();
  process.exit(0);
}

void runMigrations();
