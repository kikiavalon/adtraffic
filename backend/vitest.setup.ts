/**
 * Vitest global setup for PostgreSQL test database.
 *
 * Pushes the Drizzle schema to the test database before any tests run.
 * Requires DATABASE_URL to be set (or defaults to localhost test DB).
 */

import { execSync } from 'child_process';

export async function setup() {
  const dbUrl = process.env.DATABASE_URL ?? 'postgres://localhost:5432/adtraffic_test';
  console.log(`\n  Pushing schema to test database: ${dbUrl.replace(/\/\/.*@/, '//<credentials>@')}`);

  execSync('npx drizzle-kit push --force', {
    cwd: import.meta.dirname,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'pipe',
  });
}
