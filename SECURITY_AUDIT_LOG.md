# Security Audit Log

## Audit Date: 2026-02-17

**Auditor:** Claude Opus 4.6 (automated security audit)
**Scope:** Full codebase — backend, webapp, companion extension, shared package, Docker/nginx infrastructure
**Methodology:** OWASP Top 10 + CWE mapping + AI-generated code patterns + supply chain analysis

---

## Summary Dashboard

| Metric | Count |
|--------|-------|
| Files scanned | 45+ source files across 4 workspaces |
| Total packages in lockfile | 652 |
| npm audit vulnerabilities | 8 moderate (all dev dependencies) |
| **Critical findings** | 1 |
| **High findings** | 9 |
| **Medium findings** | 9 |
| **Low findings** | 5 |
| **Informational** | 3 |
| **Findings fixed in this pass** | 19 |
| **Accepted risks** | 5 |
| Tests after hardening | 875 passing (18 shared + 615 backend + 242 companion) |

---

## Findings & Remediations

### CRITICAL

#### C-1: [CWE-330] Client-side conversation ID generation with Math.random()
- **File:** `webapp/src/pages/Chat.tsx:186`
- **Description:** Conversation IDs generated with `Math.random()` are predictable and could enable IDOR attacks
- **Exploitation:** Attacker could predict or enumerate conversation IDs to access other users' conversations
- **Fix Applied:** Replaced `Math.random().toString(36).slice(2, 8)` with `crypto.randomUUID()`

### HIGH

#### H-1: [CWE-330] Middleware ordering allowed unauthenticated 10MB body parsing (DoS)
- **File:** `backend/src/routes/chat.ts:19`
- **Description:** `express.json({ limit: '10mb' })` ran BEFORE `requireAuth`, allowing unauthenticated users to force the server to parse large payloads
- **Fix Applied:** Reordered middleware to `chatLimiter → requireAuth → express.json({ limit: '10mb' })`

#### H-2: [CWE-327] JWT algorithm not pinned (algorithm confusion attack)
- **File:** `backend/src/auth/auth-service.ts:54,75,84`
- **Description:** `jwt.sign()` and `jwt.verify()` called without specifying algorithm, vulnerable to CVE-2016-10555
- **Fix Applied:** Added `{ algorithm: 'HS256' }` to sign and `{ algorithms: ['HS256'] }` to verify

#### H-3: [CWE-16] Rate limiter bypassed via IP spoofing
- **File:** `backend/src/index.ts`
- **Description:** No `trust proxy` config meant `req.ip` returned proxy IP, not client IP
- **Fix Applied:** Added `app.set('trust proxy', 1)` for correct client IP behind nginx

#### H-4: [CWE-799] No rate limiting on chat endpoint
- **File:** `backend/src/routes/chat.ts`
- **Description:** Chat endpoint (which calls Claude API) had no rate limit — abuse vector for API cost exhaustion
- **Fix Applied:** Added `chatLimiter` (20 req/min per IP)

#### H-5: [CWE-16] No helmet middleware for Express security headers
- **File:** `backend/src/index.ts`
- **Description:** API responses had no security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- **Fix Applied:** Installed and configured `helmet` middleware

#### H-6: [CWE-16] CORS allows any Chrome extension
- **File:** `backend/src/index.ts:17`
- **Description:** Regex `/^chrome-extension:\/\//` matches ANY Chrome extension, not just the companion
- **Status:** Documented with TODO comment for production lockdown (requires extension ID after Chrome Web Store publishing)

#### H-7: [CWE-1357] All dependency versions used floating ranges
- **Files:** All 5 `package.json` files
- **Description:** Every dependency used `^` ranges, vulnerable to supply chain attacks via malicious minor/patch versions
- **Fix Applied:** Pinned all 45 dependencies to exact installed versions

#### H-8: [CWE-532] Error logging may contain sensitive data
- **Files:** `backend/src/routes/chat.ts:69`, `conversations.ts:22,53,82`
- **Description:** `console.error('...:', error)` logged full error objects which could contain API keys, tokens, or PII
- **Fix Applied:** Changed all error logging to `error instanceof Error ? error.message : 'Unknown error'`

#### H-9: [CWE-1284] File attachment data field has no max length in Zod schema
- **File:** `shared/src/schemas/chat.ts:11`
- **Description:** `data` field (base64 file content) accepted arbitrarily large strings, bypassing the 10MB Express body limit at the schema level
- **Fix Applied:** Added `.max(15_000_000)` to `data` and `.max(10_485_760)` to `sizeBytes`

### MEDIUM

#### M-1: [CWE-209] Registration endpoint reveals email existence
- **File:** `backend/src/routes/auth.ts:34-35`
- **Description:** HTTP 409 with "Email already registered" enables email enumeration
- **Fix Applied:** Changed to generic "Registration failed" message

#### M-2: [CWE-521] Weak password policy
- **File:** `backend/src/routes/auth.ts:13`
- **Description:** Only required 8 characters minimum, no maximum length (bcrypt DoS), no complexity requirements
- **Fix Applied:** Added `.max(128)` to password schema. Complexity requirements deferred to SEC-005 in enterprise backlog.

#### M-3: [CWE-16] nginx CSP connect-src references Docker-internal hostname
- **File:** `webapp/nginx.conf:14`
- **Description:** `connect-src 'self' http://backend:3001` is not resolvable by browsers
- **Fix Applied:** Changed to `connect-src 'self'` (API proxied via nginx `/api/` location block)

#### M-4: [CWE-16] Missing Permissions-Policy header
- **File:** `webapp/nginx.conf`
- **Description:** No Permissions-Policy to disable unnecessary browser features
- **Fix Applied:** Added `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()`

#### M-5: [CWE-16] X-XSS-Protection set to deprecated mode
- **File:** `webapp/nginx.conf`
- **Description:** `X-XSS-Protection: 1; mode=block` is deprecated and can cause issues in modern browsers
- **Fix Applied:** Changed to `X-XSS-Protection: 0` (CSP provides the actual protection)

#### M-6: [CWE-16] Docker Compose exposes backend port directly
- **File:** `docker-compose.yml:7`
- **Description:** `ports: "3001:3001"` exposes backend on host, bypassing nginx security headers
- **Fix Applied:** Changed to `expose: ["3001"]` (internal only, accessible via nginx proxy)

#### M-7: [CWE-16] No resource limits in Docker Compose
- **File:** `docker-compose.yml`
- **Description:** No memory or CPU limits, enabling resource exhaustion DoS
- **Fix Applied:** Added `deploy.resources.limits` (backend: 512M/1CPU, webapp: 128M/0.5CPU), `read_only: true`, `tmpfs` mounts

#### M-8: [CWE-1284] searchString has no max length in ListFilterSchema
- **File:** `shared/src/schemas/cm360.ts:43`
- **Description:** Search string accepted arbitrarily long values, potential performance DoS
- **Fix Applied:** Added `.max(500)` to `searchString` field

#### M-9: [CWE-1284] conversationId has no max length in ChatRequestSchema
- **File:** `shared/src/schemas/chat.ts:16`
- **Description:** Conversation ID accepted arbitrarily long strings with no pattern constraint
- **Fix Applied:** Added `.max(200)` to `conversationId` field

### LOW

#### L-1: [CWE-613] JWT token lifetime of 7 days
- **File:** `backend/src/auth/auth-service.ts:54,75`
- **Description:** 7-day JWT with no refresh mechanism means stolen tokens are valid for a week
- **Status:** Tracked as AUTH-005 in enterprise backlog (requires refresh token implementation)

#### L-2: [CWE-922] JWT stored in localStorage
- **File:** `webapp/src/auth/AuthContext.tsx:42`
- **Description:** localStorage is accessible to any JS on the same origin; XSS could steal tokens
- **Status:** Accepted risk for SPA architecture. Mitigated by CSP headers preventing inline scripts.

#### L-3: [CWE-922] Conversation data in sessionStorage
- **File:** `webapp/src/pages/Chat.tsx:206-231`
- **Description:** User messages (potentially containing campaign data) stored in sessionStorage
- **Status:** Acceptable for MVP. sessionStorage cleared on tab close.

#### L-4: [CWE-16] Missing HSTS preload directive
- **File:** `webapp/nginx.conf`
- **Description:** HSTS header lacked `preload` directive
- **Fix Applied:** Added `preload` to HSTS header

#### L-5: [CWE-16] Missing frame-ancestors in CSP
- **File:** `webapp/nginx.conf`
- **Description:** CSP lacked explicit `frame-ancestors 'none'` (redundant with X-Frame-Options but defense-in-depth)
- **Fix Applied:** Added `frame-ancestors 'none'; base-uri 'self'; form-action 'self'` to CSP

### INFORMATIONAL

#### I-1: No secrets detected in git history
- **Verification:** Searched git history for `sk-ant-`, `.env` file commits, API keys — all clean

#### I-2: No hallucinated/fictional dependencies detected
- **Verification:** All 652 packages in lockfile are well-known npm packages

#### I-3: No eval()/innerHTML/dangerouslySetInnerHTML in production code
- **Verification:** Only found `innerHTML` usage in test files (acceptable for JSDOM testing)

---

## Files Created During This Audit

| File | Purpose |
|------|---------|
| `SECURITY.md` | Vulnerability reporting policy and security practices |
| `SECURITY_AUDIT_LOG.md` | This document — audit findings and remediations |
| `.github/copilot-instructions.md` | AI coding assistant security instructions |
| `.github/workflows/security.yml` | CI/CD security pipeline (dependency audit, secrets scan, lockfile integrity) |

## Files Modified During This Audit

| File | Changes |
|------|---------|
| `webapp/src/pages/Chat.tsx` | `Math.random()` → `crypto.randomUUID()` for conversation IDs |
| `backend/src/routes/chat.ts` | Middleware reordering (auth before body parser), rate limiting, error log sanitization |
| `backend/src/routes/auth.ts` | Password max length, email/name max length, generic registration error |
| `backend/src/routes/conversations.ts` | Error log sanitization (no full error objects) |
| `backend/src/auth/auth-service.ts` | JWT algorithm pinning (HS256) on sign and verify |
| `backend/src/index.ts` | Added helmet, trust proxy, CORS documentation |
| `webapp/nginx.conf` | Permissions-Policy, CSP improvements, HSTS preload, X-XSS-Protection fix |
| `docker-compose.yml` | Internal-only backend port, resource limits, read-only filesystem, ENCRYPTION_KEY passthrough |
| `shared/src/schemas/chat.ts` | Max length on file data (15M), sizeBytes (10MB), conversationId (200) |
| `shared/src/schemas/cm360.ts` | Max length on searchString (500) |
| `backend/src/__tests__/auth.test.ts` | Updated test for generic registration error message |
| All 5 `package.json` files | Pinned all 45 dependency versions from `^x.y.z` to `x.y.z` |
| `backend/package.json` | Added `helmet` dependency |

---

## Accepted Risks

| Risk | Justification | Mitigation |
|------|---------------|------------|
| JWT in localStorage | Standard SPA pattern; httpOnly cookies require same-origin API | CSP prevents inline scripts; XSS surface minimized |
| CORS allows any Chrome extension | Extension ID not yet assigned (pre-publishing) | Documented TODO; will lock down to specific extension ID |
| 7-day JWT lifetime | Refresh tokens require server-side session management | Tracked as AUTH-005 in enterprise backlog |
| 8 moderate npm audit vulns | All in dev dependencies (esbuild, vitest, drizzle-kit) | Not shipped to production; will update when safe major versions available |
| No CSRF tokens | Bearer token auth (not cookies) immune to CSRF | If cookies ever added, CSRF tokens required |

---

## Recommended Follow-Up Actions

### Immediate (before any production deployment)
1. **SEC-002:** Configure TLS in nginx or deploy behind Cloudflare/ALB
2. **SEC-003:** Lock CORS to production domain + specific extension ID
3. Set strong JWT_SECRET and ENCRYPTION_KEY in production environment

### Short-term (within 2 weeks)
4. Implement refresh token rotation (AUTH-005)
5. Add password complexity requirements (SEC-005)
6. Set up Sentry or similar for structured error logging
7. Run Gitleaks locally and add pre-commit hook

### Medium-term (within 1 month)
8. Implement RBAC (AUTH-001)
9. Implement audit logging (AUDIT-001)
10. Add 2FA/MFA (AUTH-002)

### Pre-enterprise sales
11. SOC 2 readiness assessment
12. Third-party penetration test
13. IAB Agent Registry registration

---

## Next Audit Recommendation

**Date:** 2026-03-17 (30 days)
**Trigger:** Also re-audit after any of these events:
- New external service integration (CM360 API, Stripe, etc.)
- Authentication system changes
- New user-facing endpoints
- Dependency major version upgrades
