# AdTraffic.ai — Capabilities PRD

**Version:** 3.0 (current-state capability overview)
**Date:** 2026-08-18
**Status:** Phase 2 complete, Phase 3 (launch prep) in progress
**Distribution:** Open source (Apache-2.0) — run it yourself; there is no hosted service
**Supersedes for capability reference:** `docs/PRD.md` (v2.0, 2026-02-09) — that document describes the intended v1 scope and remains the record of the architecture pivot. This document describes what the codebase actually does today.

---

## 1. Purpose of This Document

This is a complete inventory of what AdTraffic.ai does as built. It is written against the source, not the roadmap. Where a capability is implemented but unverified against Google's live systems, that is stated inline rather than glossed over.

Two facts frame everything below and are repeated because they matter:

1. **All 70 Campaign Manager 360 (CM360) tools are live-implemented** — every tool has a real API code path and none are stubbed.
2. **Zero of those live paths have been exercised against a real CM360 account.** The verified experience is demo mode (seeded mock data). The live path has not been and, per current project decision, will not be run against Google's production API before external validation. See `docs/LIVE-MODE-CAVEATS.md`.

Both can be true at once: the code exists and is fully wired; it has not been proven against Google.

---

## 2. Product Summary

AdTraffic.ai is an **open-source project**: a runnable web platform, plus supporting packages, that provides **Kiki** — an AI chat assistant that operates Google Campaign Manager 360 (CM360) through natural language. A trafficker describes what they want ("create a placement on the Toyota campaign running March 1–31"); Kiki asks clarifying questions, enforces naming conventions, previews the change, and — on confirmation — issues the CM360 API calls.

It is distributed to be **run, not sold**: clone it, drive it against seeded mock data with no accounts or keys, and — only if you want live operation — connect your own Claude key and your own CM360 account. Licensed Apache-2.0.

### Fastest way to see it — the MCP server

The lowest-friction entry point is `@adtraffic/mcp`, a zero-credential stdio Model Context Protocol (MCP) server that exposes **all 70 CM360 tools** against the seeded mock dataset. Point any MCP client (including Claude) at it and drive the full tool surface in about a minute — no database, no keys, no CM360 account:

```bash
npm install
npm run build --workspace=shared --workspace=mcp
node mcp/dist/index.js      # stdio MCP server, 70 tools over mock CM360 data
```

This is the intended first experience. The full web platform (chat, auth, persistence, live CM360) is the larger surface for anyone who wants more than the tool demo.

**Positioning (thesis):** every other CM360 automation tool (CData, Windsor.ai, Cortex) is read-only. AdTraffic.ai is designed to be the one that *writes* to CM360, conversationally. That framing shaped the original commercial concept — agency-focused, tiered pricing, enterprise holding companies as the growth target. As an open-source release the same capability is simply there to run; the commercial thesis is a bet, not a proven market fact, and is out of scope for this document.

---

## 3. System Components

The product is an npm monorepo of six workspaces:

| Workspace | What it is | Runtime role |
|---|---|---|
| `webapp/` | React 19 + TypeScript + Vite single-page app | The user-facing product: auth, Kiki chat, conversation history, settings |
| `backend/` | Node.js + Express API | Claude integration, the 70 CM360 tools, auth, OAuth, persistence, QA, telemetry |
| `companion/` | Chrome extension (Manifest V3) | Detects CM360 pages, extracts context, quick-launches the web app. Ships in the public repo. |
| `qa-runner/` | Headless Playwright worker | Trafficking QA click-through tests (redirect-chain tracing, screenshots) |
| `shared/` | TypeScript types + Zod schemas | Contract shared across the other workspaces |
| `mcp/` | `@adtraffic/mcp` stdio server | Exposes all 70 tools over the Model Context Protocol against seeded mock data, zero credentials |

---

## 4. Capabilities

### 4.1 Conversational trafficking (Kiki)

- **Chat engine** — Claude with an agentic tool-use loop: Claude proposes tool calls, the backend executes them (mock or live), returns results, and Claude continues until it has a final answer. Default model `claude-haiku-4-5`, overridable via `CLAUDE_MODEL`; a separate `CLAUDE_IO_MODEL` can be set for document parsing.
- **Real-time streaming** — responses stream to the browser over Server-Sent Events (SSE); tool activity is surfaced as it happens.
- **Quick-reply buttons** — when Kiki presents a numbered or bulleted list of options, the UI renders them as clickable pills; "something else" toggles to free text.
- **Code-block copy** — one-click copy on every rendered code block (e.g. generated tags).
- **Conversation persistence** — messages saved to PostgreSQL, cached in Redis, resumable from a history sidebar. Ownership-checked (a user cannot read another user's conversations).
- **Bounded tool loops** — a per-user `limits.max_tool_rounds` cap prevents runaway loops.

### 4.2 Trained conversational behaviors

Kiki's system prompt (615 lines) encodes behaviors that are regression-tested as first-class features, not incidental:

- **Teaching mode** — explains CM360 concepts, entity hierarchy, and corrects common misconceptions.
- **Clarifying questions** — refuses to guess on missing/ambiguous parameters; asks before acting.
- **Naming-convention enforcement** — flags and proposes fixes for campaign/placement/creative/ad name and UTM violations.
- **Advanced trafficking** — CM360 macros, UTM injection, Adobe Analytics / Demandbase / verification-vendor (e.g. DoubleVerify) integration patterns.
- **Video trafficking** — VAST/VPAID tag-type knowledge, vendor spec awareness, tag confirmation.
- **Write safety** — confirmation gates for mutating operations (see 4.4).

### 4.3 The 70 CM360 tools

All 70 are live-implemented and feature-flag-gated. Grouped by area:

| Area | Tools | Coverage |
|---|---:|---|
| **Read / core lookup** | 9 | profiles, advertisers, campaigns, sites, landing pages, placements — list/get |
| **Create (core)** | 4 | campaign, placement, landing page; get-ad |
| **Update (core)** | 5 | campaign, placement, ad, creative, landing page (patch semantics) |
| **Tag generation** | 1 | ad-serving tags for placements (VAST-aware for video) |
| **Creative lifecycle** | 8 | creatives, ads, sites, sizes, creative-campaign associations, asset upload |
| **Event tags** | 4 | impression/click tracking pixels — list/get/create/update |
| **Placement groups** | 4 | packages/roadblocks — list/get/create/update |
| **Change logs** | 2 | read-only audit trail (who changed what, when) |
| **Directory sites** | 3 | browse Google's publisher catalog; approve as target |
| **Reporting** | 6 | list/get/create/run reports, download files, validate dimension–metric combos |
| **Floodlight / conversions** | 8 | activities, activity groups, configurations, tag generation |
| **Pacing analysis** | 1 | delivery pacing vs. flight dates and budget |
| **User & role management** | 12 | account user profiles, roles, permissions, permission groups, subaccounts |
| **Total** | **70** | |

**Two deliberate design constraints:**

- **Zero delete tools.** CM360 has no delete methods for core trafficking entities — archiving is the terminal state. The product ships no delete tools at all, including for ancillary resources (like event tags) that technically support deletion. Kiki cannot delete anything.
- **Read is always safe; writes are gated.** Read operations run freely; create/update operations are individually switchable per user and pass through the confirmation gate.

The canonical tool list lives in `backend/src/claude/tool-definitions.ts` (the `CM360_TOOLS` array). Tool definitions are in `backend/src/claude/tool-definitions.ts`; input validation in `backend/src/cm360/tool-input-schemas.ts` (one Zod schema per tool).

### 4.4 Write safety and risk classification

- **Confirmation gates** — mutating operations preview their consequences and require explicit user confirmation before executing. No silent writes.
- **Risk classification** — `classifyTool()` assigns each write a risk level; `elevated` and `destructive` operations trigger the confirmation flow. Read tools are unclassified and run directly.
- **Input validation** — every tool input is validated with Zod before any API call; bad input is rejected early with an actionable message.
- **Audit-oriented responses** — tool responses carry enough context (what was requested, what changed, what the API returned) for a compliance reviewer to reconstruct the action.

### 4.5 Demo mode vs. live mode

- **Demo / mock mode** — with no CM360 connection, Kiki operates on a seeded in-memory mock CM360 dataset (advertisers, campaigns, placements, creatives, tags, reports, floodlight, users). This is the **verified** experience and powers demos, tests, and the MCP server.
- **Live mode** — once a user connects a real CM360 account via Google OAuth, the same tools route to `@googleapis/dfareporting` v5 against the user's account. Implemented, **not verified against Google's live API.**
- `DEMO_MODE` runs the whole stack without PostgreSQL/Redis for quick demonstrations.

### 4.6 Insertion Order (IO) parsing

- Upload a PDF or Excel insertion order; Claude multimodal extraction pulls structured placement data (sites, sizes, flight dates, budgets) out of it for review before anything is built. Gated by `chat.file_upload`.

### 4.7 Trafficking QA

An advisory quality-assurance subsystem that checks work after it is written. Off by default behind feature flags.

- **Advisory validation (`qa.enabled`)** — records touched entities, re-reads their configuration read-only, and validates click-through resolution and UTM rules across the campaign. Reports back as an SSE `qa_report` card and via `GET /api/v1/qa/runs`. Retention configurable (`qa.retention_days`, default 30).
- **Headless click-through tests (`qa.click_test.enabled`)** — the `qa-runner` Playwright worker renders a touched ad's exported tag, simulates the click, traces the redirect chain (HTTP 3xx, meta-refresh, and JavaScript redirects, 20-hop cap), verifies the landing page and parameters, and stores a screenshot as evidence. Runs in-process against local fixtures in demo, or via a BullMQ queue and the optional Docker `qa` profile in live/beta.
- Both flags off = the Phase-1 code path is byte-identical to having the subsystem absent (test-proven).

### 4.8 Model Context Protocol (MCP) server

- `@adtraffic/mcp` is a zero-credential stdio MCP server that exposes all 70 CM360 tools over MCP against the seeded mock dataset. It lets any MCP client (including Claude) drive the full tool surface with no accounts, keys, or infrastructure — the intended open-source demonstration path.

### 4.9 Companion Chrome extension

- **Context detection** — Manifest V3 extension detects CM360 pages (real or the bundled mock page), extracts advertiser/campaign/account context from the URL hash and DOM.
- **Quick-launch** — injects a floating "Open Kiki" button and a popup that opens the web app pre-loaded with the detected context (`?advertiserId=…&campaignId=…`), which Chat.tsx reads and seeds into the conversation.
- **Minimal permissions**, per-tab context scoping, XSS-safe popup (DOM API, not innerHTML), URL validation on stored values.

### 4.10 Accounts, keys, and per-user control

- **Auth** — email/password registration and login (JWT + bcrypt), HS256 algorithm pinning, rate limiting (login 10/min, register 5/min), timing-safe rejection.
- **Per-user Claude API key (breaking change, PR #44)** — Kiki uses the *user's own* Claude API key, entered in Settings, verified with Anthropic, and stored encrypted at rest. Kiki will not respond until a key is connected; the server key is no longer used for chat.
- **CM360 connection** — Google OAuth2 authorization-code flow (connect / callback / disconnect / status); tokens encrypted at rest (AES-256-GCM) with automatic refresh.
- **Feature flags (14 total: 10 boolean + 4 numeric)** — per-user control with database overrides over env defaults over registry defaults:
  - Booleans: `cm360.read_operations`, `cm360.write_operations`, `cm360.tag_generation`, `cm360.user_management`, `chat.enabled`, `chat.file_upload`, `compliance.eu_ai_act_disclosure`, `compliance.ai_attribution_in_exports`, `qa.enabled`, `qa.click_test.enabled`
  - Numerics: `limits.daily_api_requests` (100), `limits.max_tool_rounds` (5), `limits.chat_rate_per_minute` (20), `qa.retention_days` (30)
  - Flags gate individual tool categories per user and enforce per-user usage limits.
- **PWA** — installable on desktop/mobile (icons, manifest, meta tags).
- **Settings page** — profile, API-usage dashboard, feature-flag display, CM360 connection controls.

### 4.11 Opt-in telemetry

- **No usage data collected by default.** An optional, anonymous PostHog `app_started` boot ping is available and stays inert until the operator both configures a real key and the user opts in via `npm run telemetry`. It sends only install id, app/Node version, OS, and optional email/agency — never chat content, CM360 data, or credentials. See `docs/TELEMETRY.md`.

---

## 5. Architecture (reference)

```
Web App (React 19)
    │
    └──→ Nginx (upstream pool, least_conn, SSE passthrough)
              ├──→ Backend replica 1 ─┐
              └──→ Backend replica 2 ─┤
                                      ├──→ Claude API (per-user key, tool use)
                                      ├──→ CM360 API v5 (server-side, user OAuth)
                                      ├──→ PostgreSQL (users, sessions, tokens, conversations)
                                      ├──→ Redis (cache, rate limiting, sessions)
                                      └──→ (QA) BullMQ → qa-runner (Playwright)

Companion Chrome Extension → detects CM360 context → quick-launches the web app
```

**Key decision:** CM360 API calls are server-side (not browser-side), enabling audit logging, role-based access, background bulk processing, and a standard SaaS security model. Campaign content that appears in a conversation is persisted (chat history, pending-action and approval-queue payloads, QA runs) as plaintext; OAuth tokens and API keys are encrypted at rest.

**Tech stack:** React 19 / TypeScript / Vite (webapp); Node.js / Express / `@anthropic-ai/sdk` (backend); `@googleapis/dfareporting` v17 targeting CM360 API **v5** (v4 sunset Feb 2026); PostgreSQL + Drizzle ORM; Redis (ioredis); Zod validation; Chrome Manifest V3; Playwright + BullMQ (QA); Docker Compose deployment.

---

## 6. Security & Compliance Posture

- **Token encryption** — OAuth and per-user Claude keys encrypted at rest (AES-256-GCM).
- **OWASP hardening pass** — JWT algorithm pinning, IDOR protection (ownership checks), timing-attack fixes, helmet, CSP/HSTS/Permissions-Policy headers, pinned dependencies, error-log sanitization, Zod max-lengths on all inputs. Findings tracked in `SECURITY_AUDIT_LOG.md` (19 fixed, 5 accepted risks with rationale).
- **Compliance-aware by design (not certified):**
  - EU AI Act Article 50 (Aug 2026) — AI-attribution disclosure is a feature flag (`compliance.eu_ai_act_disclosure`, `compliance.ai_attribution_in_exports`).
  - IAB Agentic Advertising Initiative / Agent Registry / AdCP — the tool surface is designed to be registry- and AdCP-aligned; registration itself is a pre-enterprise task, not yet done.
  - GDPR/CCPA and SOC 2 Type II are design targets relevant to any hosted or commercial deployment, not current attestations. A self-hoster's own compliance obligations are their own.

Treat the compliance items as posture and intent, verified in code where flags exist and pending where certification is required.

---

## 7. Operations & Observability

- **Structured logging** — Pino JSON logs with sensitive-field redaction; zero `console.log` in production source.
- **Metrics** — Prometheus `/metrics` with HTTP request counts/durations, Claude request/token counters, active-connection gauge; route normalization prevents label-cardinality blowups.
- **Health checks** — `/health/live` (liveness), `/health/ready` (PostgreSQL + Redis readiness), `/health` (full status with DB connectivity test).
- **Correlation IDs** — `X-Request-ID` propagated and echoed.
- **Error reporting** — Sentry with PII redaction, gracefully disabled when unset.
- **Horizontal scaling** — Nginx upstream pool, 2 backend replicas, graceful 30s connection drain, migration init container.
- **CI/CD** — GitHub Actions: lint, typecheck, test (with PostgreSQL), build, docker-build; separate security pipeline (dependency audit, secrets scan, lockfile integrity).

---

## 8. Testing

The suite is large and behavior-focused. Static count of `it()`/`test()` blocks by workspace: shared 108, backend 1,346, webapp 290, companion 243, qa-runner 32, mcp 7. The behavioral suites (teaching mode, clarifying questions, naming conventions, advanced/video trafficking, prompt-injection defense) iterate over fixture sets, so the reported run-time total is higher (~2,400 per `CLAUDE.md`).

What the tests actually cover: the agentic tool loop, all 70 tool definitions and input schemas, mock data store, auth/middleware, feature-flag resolution and tool gating, write-risk classification, CM360 client mapping, OAuth routes, Trafficking QA (advisory + click-through, including real-browser Playwright e2e), and the MCP server (including a stdio spawn e2e). The qa-runner e2e tests auto-skip when Chromium is absent.

**Caveat that overrides the green suite:** tests validate behavior against mock CM360 data and mocked Claude responses. They do **not** prove the live CM360 path works against Google.

---

## 9. Honest State — What Is and Isn't Done

**Done and verified (against mocks/demo):**
- End-to-end SaaS prototype: auth, per-user Claude key, chat, streaming, conversation persistence, settings.
- All 70 CM360 tools callable in demo mode; MCP server exposing them credential-free.
- Companion extension, IO parsing, Trafficking QA (both layers), PWA, feature flags, observability, Docker deployment.

**Implemented but unverified:**
- Every tool's live CM360 path. No live API call has been made against a real account, and the current decision is not to before external validation.

**Not done — and what it means for an open-source user:**
- **Live CM360 validation** — no tool has been run against a real account. A contributor with CM360 access validating the live path is the single most valuable contribution the project can receive. Until then, demo mode is the supported experience.
- **Hosting** — there is no official hosted instance. Self-host via Docker Compose or run locally; a hosted deployment is any operator's own choice.
- **Google OAuth app** — live mode requires each deployer to register their *own* Google Cloud project and OAuth client. Sensitive write scopes cap an unverified app at 100 users until that deployer completes Google's verification.
- **Commercial go-to-market** — marketing site, privacy policy at adtraffic.ai, IAB Agent Registry registration, and agency beta testing are tasks for a commercial operator, out of scope for the open-source distribution.

---

## 10. Open Questions & Known Limitations

Reframed for an open-source project. The original commercial open questions — pricing validation, SOC 2 timeline, database/auth/deployment choices — are resolved or out of scope; see the v2 PRD for that history.

**Decided stances:**
- **Demo mode is the verified boundary; live CM360 ships labeled beta/unverified.** CM360 (dfareporting) has no sandbox or synthetic-data environment — the only way to exercise the API is against real campaign data behind a real login. Rather than gate the release on acquiring a paid CM360 seat, the project treats seeded demo mode as the supported, tested experience and ships the live path unverified, clearly labeled as such in the README, Settings, and tool responses. A contributor with CM360 access validating the live path remains welcome, but it is not a release blocker.

**Open questions:**
- **Contribution & governance** — `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` exist; the actual review/merge model and whether the security-disclosure contact is monitored need confirming for a public repo.
- **Insertion Order format coverage** — parsing accuracy across real publisher IOs is untested at breadth; community-contributed sample IOs would become fixtures.
- **Kiki's voice** — the persona is encoded in the system prompt and is forkable; there is no guidance yet for downstream forks that want to retune it.

**Known limitations (as shipped):**
- Live CM360 path is implemented but unverified; demo mode is the verified experience.
- No delete operations anywhere, by design (archiving is CM360's terminal state).
- Telemetry is inert until an operator configures a key *and* a user opts in.

---

## 11. Revision History

| Date | Version | Notes |
|---|---|---|
| 2026-02-09 | 2.0 | Architecture pivot to web platform + companion extension (see `docs/PRD.md`). |
| 2026-08-18 | 3.0 | Current-state capability overview: 70 live-implemented tools, per-user Claude key, Trafficking QA, MCP server, opt-in telemetry, feature flags. Live path unverified against real CM360. |
| 2026-08-18 | 3.1 | Open-source pass: lead with the MCP demo, reframe launch "blockers" as self-host/contributor items, replace commercial open questions with open-source ones. |
