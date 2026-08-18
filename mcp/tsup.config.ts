import { defineConfig } from 'tsup';

// The published package must be self-contained: @adtraffic/shared is a private
// workspace package that is NOT on npm, so it is bundled INTO the output here
// (noExternal). The MCP SDK and zod stay external — they resolve from the
// registry as normal runtime dependencies.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  dts: true,
  clean: true,
  sourcemap: true,
  noExternal: ['@adtraffic/shared'],
  external: ['@modelcontextprotocol/sdk', 'zod'],
  // No banner: src/index.ts already carries the shebang and tsup preserves it.
  // Adding a banner here produced a duplicate shebang (invalid JS on line 2).
});
