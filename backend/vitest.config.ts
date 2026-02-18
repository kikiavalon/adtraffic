import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run test files sequentially — required because all test files
    // share a single SQLite database and concurrent table mutations
    // cause FK constraint race conditions.
    fileParallelism: false,
    // Ensure database tables exist before tests run (needed in CI where
    // there's no pre-existing database from drizzle-kit push)
    globalSetup: './vitest.setup.ts',
  },
});
