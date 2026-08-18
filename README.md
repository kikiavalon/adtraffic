# AdTraffic.ai

The first conversational AI trafficking tool for Google Campaign Manager 360.

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
