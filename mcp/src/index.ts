#!/usr/bin/env node
/**
 * AdTraffic MCP server — stdio entry point.
 *
 * MCP over stdio requires stdout to carry protocol frames only, so this
 * process never writes to stdout; any diagnostics go to stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAdTrafficServer } from './server.js';

async function main(): Promise<void> {
  const server = createAdTrafficServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`adtraffic-mcp: fatal startup error: ${detail}\n`);
  process.exit(1);
});
