import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run test files sequentially — required because all test files
    // share a single PostgreSQL database and concurrent table mutations
    // cause FK constraint race conditions.
    fileParallelism: false,
    // Ensure database tables exist before tests run (needed in CI where
    // there's no pre-existing database from drizzle-kit push)
    globalSetup: './vitest.setup.ts',
    coverage: {
      // Measured with the v8 provider when `vitest run --coverage` is invoked
      // (the `test:coverage` script / the CI Coverage job); a normal test run is
      // unaffected. Reports the source under src, excluding tests and type decls.
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/**/*.d.ts'],
      // Floors set below the current baseline (~71% stmts/lines, 75% branches,
      // 79% funcs at time of writing) so the Coverage job fails on a real
      // regression without flaking on small, legitimate changes.
      thresholds: { statements: 65, branches: 68, functions: 72, lines: 65 },
    },
  },
});
