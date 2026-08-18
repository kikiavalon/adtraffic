/**
 * End-to-end test of the stdio entry point: spawns the BUILT server
 * (dist/index.js) as a child process and speaks real JSON-RPC over
 * stdin/stdout via the SDK's stdio client transport.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CM360_TOOLS } from '@adtraffic/shared/mock-cm360';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const mcpRoot = path.resolve(testDir, '..', '..');
const repoRoot = path.resolve(mcpRoot, '..');
const distEntry = path.join(mcpRoot, 'dist', 'index.js');

beforeAll(() => {
  // Precondition: shared/dist must already be built — this file statically
  // imports @adtraffic/shared/mock-cm360, so module collection fails before
  // any hook runs if it is missing (CI builds shared explicitly). This guard
  // only self-heals a missing mcp/dist by building it before spawning.
  if (!existsSync(distEntry)) {
    execFileSync('npm', ['run', 'build', '--workspace', 'mcp'], {
      cwd: repoRoot,
      stdio: 'inherit',
      timeout: 120_000,
    });
  }
}, 180_000);

const openClients: Client[] = [];

afterEach(async () => {
  // Closing the client tears down the transport, which kills the child process.
  await Promise.all(openClients.splice(0).map((client) => client.close()));
});

describe('stdio entry point', () => {
  it(
    'spawns the built server and lists all CM360 tools over stdio',
    async () => {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [distEntry],
      });
      const client = new Client({ name: 'stdio-test', version: '0.0.0' });
      openClients.push(client);
      await client.connect(transport);

      const { tools } = await client.listTools();
      expect(tools).toHaveLength(CM360_TOOLS.length);
      expect(tools.map((t) => t.name)).toContain('cm360_list_profiles');
    },
    30_000,
  );
});
