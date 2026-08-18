# AdTraffic.ai

An open-source conversational trafficking assistant for Google Campaign Manager 360 — a full agent with built-in CM360/UTM domain expertise, write-safety confirmation, and automated QA, and one of the few open tools that can *write* to CM360 (create and update campaigns, placements, ads, creatives), not just read it. It fills the gap Google left when it sunset Bulkdozer in 2023.

**Kiki** is an AI-powered chat assistant that automates CM360 ad trafficking through natural language. Built as a web platform with a companion Chrome extension.

## Quick Start

```bash
npm install
npm run dev          # Starts backend (port 3001) + webapp (port 5173)
```

### Connect your Claude API key (required)

**Breaking change:** Kiki now uses **your own** Claude API key instead of a shared server key. After signing in, open **Settings → Claude API**, paste a key from [console.anthropic.com](https://console.anthropic.com/settings/keys), and click Connect. The key is verified with Anthropic and stored encrypted at rest; Kiki will not respond until a key is connected. The server `ANTHROPIC_API_KEY` is no longer used for chat.

## Architecture

```
webapp/      → React 19 web app (chat, auth, settings)
backend/     → Express API (Claude integration, CM360 tools, auth, DB)
companion/   → Chrome extension (CM360 context detection, quick-launch)
qa-runner/   → Headless Playwright click-test worker (Trafficking QA)
shared/      → Shared TypeScript types + Zod schemas
```

## Tool coverage

70 tools, all live-implemented · 0 verified against a real CM360 account — the
live path has not been and will not be exercised against Google's live API; use
demo mode for the verified experience.

## Tests

```bash
npm test                             # All 317 tests
npm test --workspace=shared          # 18 schema tests
npm test --workspace=backend         # 290 tests (unit + prompt regression + conversation flows)
npm test --workspace=companion       # 9 context extractor tests
```

## Chrome Extension

```bash
npm run build --workspace=companion  # Build to companion/dist/
# Load companion/dist/ as unpacked extension in chrome://extensions
```

Navigate to `http://localhost:5173/mock-cm360.html` to test extension context detection.

## Docker

```bash
docker compose up --build
```

## Trafficking QA click tests

Trafficking QA is advisory post-write validation. Phase 2 adds optional headless
**click-through tests** (Playwright): touched ads' tags are clicked, the redirect
chain traced, and the landing page verified with a stored screenshot. Two feature
flags gate it, both **off by default**: `qa.enabled` and `qa.click_test.enabled`.

**Demo mode** — click tests run in-process against local `/demo/*` fixtures. Install
the browser once, then build the worker workspace:

```bash
npx playwright install chromium
npm run build --workspace=qa-runner
```

Without a browser installed, click checks report `skipped` with a hint (nothing breaks).

**Live (beta)** — the click-test worker runs as an optional compose service behind the
`qa` profile, so the default quickstart is unaffected:

```bash
docker compose --profile qa up
```

**Tests** — the qa-runner end-to-end suite auto-skips when no browser is present
(`describe.skipIf`) and touches only localhost fixtures:

```bash
npm test --workspace=qa-runner
```

## Status

- Phase 1 (Foundation): Complete
- Phase 2 (Core Platform): Complete
- Phase 3 (Launch Prep): In progress

See [CLAUDE.md](CLAUDE.md) for full project context.

## Telemetry

AdTraffic collects **no usage data by default**. Optional, anonymous telemetry is
available and OFF until you run `npm run telemetry`. See [docs/TELEMETRY.md](docs/TELEMETRY.md).

## Using this at an agency?

I'd love to know how AdTraffic is being used in the wild. Two easy ways to help:

- **Star the repo** — it's the signal I watch most.
- **Get release notifications** (drop your email + agency): BUTTONDOWN_URL_PLACEHOLDER

No account, no gate — the tool is yours to run either way.
