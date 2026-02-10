import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run test files sequentially — required because all test files
    // share a single SQLite database and concurrent table mutations
    // cause FK constraint race conditions.
    fileParallelism: false,
  },
});
