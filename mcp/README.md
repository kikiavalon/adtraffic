# @adtraffic/mcp

A zero-credential demo Model Context Protocol (MCP) server for AdTraffic.ai. It exposes Kiki's 70 Campaign Manager 360 (CM360) trafficking tools — campaigns, placements, ads, creatives, event tags, floodlight, reporting, user/role management — against seeded, deterministic mock data. No Google account, OAuth setup, or API keys required.

## Requirements

- Node.js >= 20
- macOS or Linux (Windows is untested)

## Setup

The npm package is private and unpublished, so `npx @adtraffic/mcp` does **not** work yet (publishing is on the roadmap). Run the server from a local checkout instead.

From a clean checkout, build both the `shared` and `mcp` workspaces (the server imports its mock data layer from `@adtraffic/shared/mock-cm360`, so `shared` must be built too — the root build covers both):

```bash
npm ci
npm run build
```

### Claude Desktop

Add to your Claude Desktop MCP configuration (replace `<absolute path>` with the repository root):

```json
{
  "mcpServers": {
    "adtraffic-demo": {
      "command": "node",
      "args": ["<absolute path>/mcp/dist/index.js"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add adtraffic-demo -- node <absolute path>/mcp/dist/index.js
```

## Behavior notes

- **Write tools execute immediately.** There is no confirmation step in the MCP path. The AdTraffic.ai webapp's confirmation gates are a webapp feature; MCP clients bring their own tool-approval UX.
- **All state is in-memory.** Each spawned server process has its own in-memory store, reset on restart.
- **Demo data only.** Tools operate on seeded mock CM360 data (`@adtraffic/shared/mock-cm360`). Live CM360 access over MCP is a roadmap item, not shipped.
- **Error contract.** Failed tool calls return a flat JSON payload: `{"error": string, "details"?: string}`.
- **Protocol hygiene.** stdout carries only MCP protocol messages; diagnostics go to stderr.

## Development

Run the Setup build first — the tests import from `@adtraffic/shared/mock-cm360`, so an unbuilt `shared` workspace fails module collection with a raw resolution error.

```bash
npm test --workspace=mcp        # vitest (includes an end-to-end stdio test against the built server)
npm run lint --workspace=mcp
npm run typecheck --workspace=mcp
```

## License

Not yet licensed for redistribution — this repository is currently private. The planned public release will be under Apache-2.0.
