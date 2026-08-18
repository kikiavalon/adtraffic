# @adtraffic/mcp

A zero-credential stdio [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server exposing all 70 of AdTraffic's Google Campaign Manager 360 (CM360) tools against seeded, deterministic mock data.

No database, no API keys, no Google account — point any MCP client (Claude Desktop included) at it and drive the full tool surface in about a minute.

Part of the [AdTraffic.ai / Kiki](https://github.com/kikiavalon/adtraffic) open-source project.

## Quick start

Run it directly — no clone, no build:

```bash
npx @adtraffic/mcp
```

That launches the stdio MCP server with all 70 tools over mock CM360 data. Configure your MCP client to launch `npx @adtraffic/mcp` over stdio — for example, in Claude Desktop's config:

```json
{
  "mcpServers": {
    "adtraffic": { "command": "npx", "args": ["@adtraffic/mcp"] }
  }
}
```

### From source (contributors)

```bash
npm install
npm run build --workspace=shared
npm run build --workspace=mcp
node mcp/dist/index.js     # stdio MCP server, 70 tools over mock CM360 data
```

## What's inside

- All 70 CM360 tools (read, create, update, tags, reporting, floodlight, event tags, placement groups, user/role management) executing against `@adtraffic/shared/mock-cm360` — a dependency-free, seeded mock of CM360.
- Zero delete tools, by design: CM360 treats archiving as the terminal state.
- Flat, consistent error contract; inputs validated with Zod.

**This package never talks to Google.** It operates exclusively on mock data. Live CM360 operation is a feature of the full AdTraffic platform, not this server.

## Disclaimer — no warranty, use at your own risk

THIS SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.

This server operates on mock data only. The wider AdTraffic project includes a
live Campaign Manager 360 path that is **implemented but unverified** against
Google's production API; before using any live-capable component of the
project, read the full
[DISCLAIMER](https://github.com/kikiavalon/adtraffic/blob/main/DISCLAIMER.md).
Kiki is an LLM agent and is non-deterministic; review every proposed change
before confirming it. You are responsible for your own credentials, accounts,
spend, and compliance.

This notice restates, and does not modify or add to, the Disclaimer of Warranty
and Limitation of Liability in Sections 7 and 8 of the Apache License,
Version 2.0.

## License & trademarks

[Apache-2.0](https://github.com/kikiavalon/adtraffic/blob/main/LICENSE). "AdTraffic.ai" and "Kiki" are reserved marks — see [TRADEMARKS.md](https://github.com/kikiavalon/adtraffic/blob/main/TRADEMARKS.md). "Google", "Campaign Manager 360", and "CM360" are trademarks of Google LLC; this project is independent and not affiliated with, endorsed by, or sponsored by Google.
