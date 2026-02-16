# AdTraffic.ai

The first conversational AI trafficking tool for Google Campaign Manager 360.

**Kiki** is an AI-powered chat assistant that automates CM360 ad trafficking through natural language. Built as a web platform with a companion Chrome extension.

## Quick Start

```bash
npm install
npm run dev          # Starts backend (port 3001) + webapp (port 5173)
```

Add an `ANTHROPIC_API_KEY` to `backend/.env` to enable live Claude AI responses. Without it, Kiki uses mock CM360 data.

## Architecture

```
webapp/      → React 19 web app (chat, auth, settings)
backend/     → Express API (Claude integration, CM360 tools, auth, DB)
companion/   → Chrome extension (CM360 context detection, quick-launch)
shared/      → Shared TypeScript types + Zod schemas
```

## Tests

```bash
npm test                             # All 177 tests
npm test --workspace=shared          # 18 schema tests
npm test --workspace=backend         # 150 tests (unit + prompt regression + conversation flows)
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

## Status

- Phase 1 (Foundation): Complete
- Phase 2 (Core Platform): Complete
- Phase 3 (Launch Prep): In progress

See [CLAUDE.md](CLAUDE.md) for full project context.
