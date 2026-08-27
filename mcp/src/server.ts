/**
 * AdTraffic MCP server — exposes the 70 mock CM360 tools over the
 * Model Context Protocol.
 *
 * Uses the low-level Server (not McpServer): our tool definitions are
 * already JSON Schema, so the ListTools handler passes them through
 * untouched instead of round-tripping through zod shapes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CM360_TOOLS, executeToolMock, type ToolResult } from '@adtraffic/shared/mock-cm360';

export const SERVER_NAME = 'adtraffic-mcp';

// Derive the advertised version from package.json so it can never drift from the
// published package. server.ts (src/) and the tsup bundle (dist/) both sit one
// level below the package root, and npm always ships package.json in the
// tarball — so '../package.json' resolves under test and at runtime alike.
const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
) as { version: string };
export const SERVER_VERSION = pkg.version;

/** Flat error payload — every error response serializes to this shape. */
interface ErrorPayload {
  error: string;
  details?: string;
}

function toErrorPayload(result: ToolResult): ErrorPayload {
  if (result.errorMessage !== undefined) {
    return { error: result.errorMessage };
  }
  const raw = result.result;
  if (typeof raw === 'object' && raw !== null && typeof (raw as ErrorPayload).error === 'string') {
    // Validation failures already carry { error, details } — pass through flat.
    const { error, details } = raw as ErrorPayload;
    return typeof details === 'string' ? { error, details } : { error };
  }
  return { error: String(raw) };
}

export function createAdTrafficServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: CM360_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input_schema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, (request) => {
    const { name, arguments: args } = request.params;
    const result = executeToolMock(name, args ?? {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.isError ? toErrorPayload(result) : result.result, null, 2),
        },
      ],
      isError: result.isError,
    };
  });

  return server;
}
