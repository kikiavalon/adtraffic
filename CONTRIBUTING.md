# Contributing to AdTraffic.ai / Kiki

Thanks for your interest in contributing! This project is a conversational
trafficking assistant for Google Campaign Manager 360 (CM360). Contributions of
all sizes are welcome — bug reports, docs, tests, and code.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
Contributions are accepted under the project's [Apache-2.0 license](LICENSE).

## Repository layout

This is an npm-workspaces monorepo:

| Workspace | What it is |
|---|---|
| `shared/` | Shared TypeScript types, Zod schemas, and the dependency-free mock CM360 layer (`@adtraffic/shared/mock-cm360`) |
| `backend/` | Express API — auth, chat, the Claude agentic loop, CM360 tool executor, feature flags |
| `webapp/` | React 19 + Vite web app (Kiki chat, settings) |
| `mcp/` | `@adtraffic/mcp` — a stdio Model Context Protocol server exposing the CM360 tools against seeded mock data |
| `qa-runner/` | Headless click-through QA runner (Playwright) |

## Prerequisites

- **Node.js ≥ 20** (`node -v`)
- **PostgreSQL** — only required to run the `backend` test suite
- An **Anthropic API key** if you want to run Kiki against the real Claude API
  (the app runs on seeded mock data without one)

## Getting started

```bash
npm install
npm run build --workspace=shared   # other workspaces build against shared's output
```

### Run the app in demo mode (no database, no CM360 account)

```bash
export DEMO_MODE=true
export ANTHROPIC_API_KEY=sk-ant-...   # optional; without it, Kiki returns canned mock responses
npm run dev                            # backend on :3001, webapp on :5173
```

### Try the MCP server

```bash
npm run build --workspace=shared
npm run build --workspace=mcp
node mcp/dist/index.js                 # stdio MCP server; point Claude Desktop (or any MCP client) at this command
```

## Running the checks

The full gate mirrors CI:

```bash
npm run build        # all workspaces
npm run typecheck
npm run lint
npm test             # all workspaces
```

### Backend tests need a local Postgres

```bash
createdb adtraffic_test
export DATABASE_URL="postgres://localhost:5432/adtraffic_test"
npx --prefix backend drizzle-kit push   # apply the schema to the test DB
npm test --workspace=backend
```

Individual suites:

```bash
npm test --workspace=shared
npm test --workspace=mcp
npm test --workspace=webapp
npm test --workspace=qa-runner   # 5 e2e tests need Chromium (Playwright)
```

## Development conventions

- **Tests first.** This codebase treats agent behavior as a product spec — new
  behavior comes with tests. Please don't ship a change with a red or missing test.
- **Type-safe.** No `any`. All tool inputs are validated with Zod.
- **Confirm before mutating.** Write operations against CM360 are gated behind
  confirmation — preserve that safety when touching tool execution.
- **Line endings are LF** (enforced via `.gitattributes`).
- Keep `npm run lint` and `npm run typecheck` clean.

## Submitting a change

1. Fork the repo and create a branch from `main`.
2. Make your change with tests; run the full gate above until green.
3. Open a pull request describing **what** changed and **why**. Link any related issue.
4. CI must pass. A maintainer will review; please be responsive to feedback.

## Reporting bugs & requesting features

Use the issue templates. For bugs, include repro steps, expected vs. actual
behavior, and your environment (OS, Node version). For security issues, please
follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
