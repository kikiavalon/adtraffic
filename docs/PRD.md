# AdTraffic.ai — Product Requirements Document

**Version:** 2.0
**Date:** 2026-02-09
**Status:** Architecture pivot approved by founder (v2 — web platform + companion extension)

---

## Product Overview

AdTraffic.ai is a **web platform** with a companion Chrome extension that provides a chat-based AI assistant named **Kiki** for automating Google Campaign Manager 360 (CM360) ad trafficking. Traffickers upload an Insertion Order, Kiki parses it, fills smart defaults, presents a full build preview, and creates the entire campaign structure in CM360 on a single approval.

The web app (app.adtraffic.ai) is the primary product — login, Kiki chat, conversation history, team management, and billing all live here. The companion Chrome extension is lightweight: it detects when the user is in CM360, provides a quick-launch button to open the web app, and can pass CM360 context (current advertiser, campaign ID) to Kiki to seed conversations. CM360 API calls are made server-side through the AdTraffic.ai backend using the user's OAuth tokens (stored encrypted, managed via standard Google OAuth2 authorization code flow).

---

## Target User Persona

**Name:** Katie — Senior Trafficking Specialist
**Company:** Mid-size digital agency (50-200 people), manages 10-30 active clients
**Tools:** Lives in Chrome all day. CM360 is open in one tab, email in another, spreadsheets in a third.
**Daily reality:**
- Receives 2-5 new IOs per week from media buyers
- Manually re-enters IO details into CM360: campaign setup, placement creation, creative assignments, tag generation
- Spends 30-90 minutes per campaign on repetitive data entry
- Naming conventions are critical — one inconsistency breaks reporting and billing
- Under constant deadline pressure (campaigns launch on specific dates, no flexibility)
- Has zero tolerance for errors — wrong dates, wrong sizes, or wrong site assignments mean wasted ad spend on real client budgets

**What Katie wants:** "I want to hand off the IO and get back a fully built campaign in CM360, correctly named, with tags ready to send to the publisher. In minutes, not hours."

---

## Problem Statement

Ad trafficking in CM360 is manual, repetitive, and error-prone. After Google sunset Bulkdozer in August 2023, no tool exists that offers write access to CM360 through any kind of automation — let alone natural language. Every existing alternative (CData, Windsor, Cortex) is read-only. Traffickers are stuck point-and-clicking through Google's UI, one placement at a time, for every campaign they build.

This wastes hours of skilled labor per week, introduces human error into high-stakes workflows (real ad spend, real client money), and creates a bottleneck that slows down campaign launches across the agency.

---

## Core Features — v1 Scope

### What's In

#### 1. Chat Interface with Kiki
- Web app at app.adtraffic.ai — clean, responsive chat UI
- Message input, file upload (drag-and-drop), conversation history
- Kiki responds conversationally, asks clarifying questions when needed
- Quick-select buttons when Kiki presents options (advertiser picker, campaign selector, etc.)
- Conversations persist across sessions (stored server-side)
- Companion Chrome extension provides quick-launch from within CM360 and passes page context to Kiki

#### 2. IO Upload + Parsing
- Accept PDF and Excel (.xlsx) file uploads via drag-and-drop or file picker
- Kiki extracts: site name, placement details (names, sizes, ad types), flight dates, impression/budget goals, rates
- Presents extracted data back to the user for confirmation before proceeding
- Handles common IO formats from major publishers (ESPN, CNN, NBCUniversal, etc.)
- Graceful handling of ambiguous or incomplete IOs — Kiki asks clarifying questions rather than guessing

#### 3. Campaign Creation from IO
- Create campaign with correct advertiser, name, dates, and default landing page
- Create all placements specified in the IO with correct sites, sizes, dates, and naming conventions
- Group placements into placement groups (packages) based on IO structure
- Assign creatives to placements
- Set up landing pages
- Generate ad serving tags for all placements
- **Build preview before execution** — Kiki shows a complete summary of everything she's about to create, waits for approval

#### 4. Placement Groups / Packages
- Create and manage placement groups
- Group placements by package/roadblock as specified in the IO
- List existing placement groups within a campaign

#### 5. Creative Assignments
- List available creatives for an advertiser
- Assign creatives to campaigns (campaign creative associations)
- Assign creatives to specific placements via ad creation
- Support creative rotation settings

#### 6. Landing Page Setup
- List existing landing pages for an advertiser
- Create new landing pages
- Set default landing page for campaigns
- Assign landing pages to specific ads

#### 7. Bulk Rename Operations
- Rename multiple placements, ads, or creatives in a single operation
- Preview all name changes before executing
- Support pattern-based renaming (find/replace, prefix/suffix, sequential numbering)

#### 8. Tag Generation
- Generate ad serving tags for individual placements or bulk
- Support all tag formats (standard, iframe, JavaScript, tracking)
- Present tags in a copy-friendly format
- VAST-compliant output for video placements

#### 9. List / Search / Get Operations
- List and search campaigns, placements, ads, creatives, sites, advertisers
- Filter by name, date, status, advertiser, campaign
- Quick lookups ("show me all active placements for Toyota")
- Get detailed information about a specific campaign, placement, ad, creative, or landing page by ID

#### 10. Update / Manage Entities
- Update existing campaigns (name, dates, archived status, default landing page)
- Update existing placements (name, active status, pricing schedule dates). Note: size, site, and compatibility are immutable after creation.
- Update existing ads (name, active/archived status, start/end times, placement assignments, creative assignment)
- Update existing creatives (name, active/archived status). Note: creative type and size are immutable after creation.
- Update existing landing pages (name, URL, archived status)
- Archive or reactivate any entity
- Always shows current state vs. proposed changes before executing an update
- Warns when archiving may affect live campaigns

#### 11. Build Preview & Confirmation
- Every write operation shows a detailed preview before execution
- Preview includes: what will be created/modified, field values, count of items
- Single approval to execute the full build
- Clear success/failure reporting after execution
- Ability to cancel at the preview stage

### What's Explicitly Out of v1

| Feature | Why It's Out | Target |
|---|---|---|
| Floodlight activity setup | Important but not core to the IO→campaign workflow | v1.5 |
| User preferences / memory | Valuable accelerator but v1 works without it | v1.5 |
| Reporting | CM360 has its own reporting; not a trafficker's core pain point | v1.5 |
| Billing management | Back-office function, not trafficking | v2 |
| CTV campaign support | Niche; standard display/video is the priority | v2 |
| Targeting templates / remarketing lists | Advanced feature for mature users | v2 |
| IAB Agent Registry registration | Required before enterprise sales, not before beta | Pre-enterprise launch |
| Floodlight configurations | Account-level settings, rarely changed | v2 |
| Dynamic creatives | Complex feature, small user base | v2+ |
| Multi-browser companion extension (Firefox, Safari) | Chrome is where CM360 lives; web app works everywhere | Not planned |

---

## User Workflows

### Workflow 1: IO-to-Campaign (Primary)

This is the core workflow — the reason someone buys AdTraffic.ai.

```
1. Trafficker opens app.adtraffic.ai (or clicks companion extension while in CM360)
2. Kiki's chat opens
3. Trafficker drags an IO (PDF/Excel) into the chat
4. Kiki reads the IO and extracts:
   - Publisher/site
   - Placement specs (sizes, types, names)
   - Flight dates
   - Budget/impressions
   - Any other details present
5. Kiki presents the extracted data:
   "I found 5 placements on ESPN.com running Jul 1–Sep 30.
    Here's what I see: [summary table]
    Is this correct?"
6. Trafficker confirms or corrects
7. Kiki asks what she can't get from the IO:
   - "Which advertiser?" → shows list from CM360
   - "Which campaign? Or should I create a new one?"
   - "What landing page?" → shows existing or offers to create
   - "What naming convention?" → suggests based on IO details
8. Kiki builds the full preview:
   "Here's what I'm going to create:
    ✓ 1 campaign: 'Toyota_Q3_2026_ESPN'
    ✓ 5 placements (3 display, 2 video) in 1 package
    ✓ 5 ads with creative assignments
    ✓ Default landing page: toyota.com/offers
    Ready to build?"
9. Trafficker approves
10. Kiki creates everything in CM360 and reports back:
    "Done! Created 5 placements and 5 ads.
     Here are your tags: [copy-friendly tag list]
     Anything else?"
```

### Workflow 2: Quick Lookup

```
1. Trafficker: "Show me all active placements for Toyota Q3"
2. Kiki queries CM360, returns formatted list:
   - Placement name, site, size, dates, status
3. Trafficker: "Rename all of those to add '_v2' suffix"
4. Kiki shows preview of all name changes
5. Trafficker approves
6. Kiki executes bulk rename
```

### Workflow 3: Add Placements to Existing Campaign

```
1. Trafficker: "I need to add 3 new placements to the Toyota Q3 campaign on CNN"
2. Kiki: "What sizes and dates?"
3. Trafficker provides details (or uploads a supplemental IO)
4. Kiki builds preview, trafficker approves, Kiki creates
```

### Workflow 4: Generate Tags

```
1. Trafficker: "Generate tags for all placements in campaign 'Toyota_Q3_2026_ESPN'"
2. Kiki fetches placements, generates tags for each
3. Presents tags in a copyable format
4. Trafficker copies and sends to publisher
```

### Workflow 5: Creative Management

```
1. Trafficker: "Assign the Toyota Summer 300x250 creative to all 300x250 placements in the Q3 campaign"
2. Kiki identifies matching placements and creative
3. Shows preview: "I'll assign 'Toyota_Summer_300x250' to these 4 placements: [list]"
4. Trafficker approves
5. Kiki creates the ads with creative assignments
```

---

## Technical Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                           │
│                                                                 │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │   CM360 Web UI        │  │  AdTraffic.ai Companion         │  │
│  │   (Google's site)     │  │  Chrome Extension               │  │
│  │                       │  │                                 │  │
│  │                       │  │  • "Open Kiki" quick-launch     │  │
│  │                       │  │  • Detects CM360 page context   │  │
│  │                       │  │  • Passes advertiser/campaign   │  │
│  │                       │  │    IDs to web app               │  │
│  └───────────────────────┘  └──────────────┬──────────────────┘  │
│                                            │                    │
│  ┌─────────────────────────────────────────┴────────────────┐   │
│  │   app.adtraffic.ai (Web App)                              │   │
│  │                                                           │   │
│  │   ┌─────────────────┐   ┌────────────────────────────┐   │   │
│  │   │  Kiki Chat UI    │   │  Dashboard / Settings /     │   │   │
│  │   │  (React)         │   │  Team Management / Billing  │   │   │
│  │   └────────┬────────┘   └────────────────────────────┘   │   │
│  └────────────┼──────────────────────────────────────────────┘   │
│               │                                                  │
└───────────────┼──────────────────────────────────────────────────┘
                │
                ▼
    ┌───────────────────────────────────────────────────┐
    │  AdTraffic.ai Backend (api.adtraffic.ai)          │
    │                                                   │
    │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
    │  │ Auth / Users  │  │ Claude API    │  │ CM360   │ │
    │  │ Billing       │  │ Proxy         │  │ Client  │ │
    │  │ Sessions      │  │ (Sonnet/Opus) │  │ (v5)    │ │
    │  └──────────────┘  └──────────────┘  └────┬────┘ │
    │                                           │      │
    │  ┌──────────────┐  ┌──────────────────────┘      │
    │  │ Database      │  │                            │
    │  │ (users,       │  ▼                            │
    │  │  sessions,    │  Google CM360 API v5           │
    │  │  OAuth tokens │  (dfareporting)               │
    │  │  encrypted)   │  User's OAuth — managed       │
    │  └──────────────┘  server-side, encrypted at rest │
    └───────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Primary interface** | Web app (app.adtraffic.ai) | Enterprise credibility, standard SaaS model, multi-device access, richer UI surface for dashboards/team management |
| **Chrome extension** | Lightweight companion (Manifest V3) | Context detection in CM360, quick-launch to web app, passes page context — not the product itself |
| **Frontend** | React 19 + TypeScript | Componentized chat UI, shared component library between web app features |
| **CM360 API calls** | Server-side via our backend | Enables server-side audit logging, RBAC, rate limiting, background processing for bulk ops. User OAuth tokens stored encrypted. |
| **OAuth for CM360** | Standard Google OAuth2 authorization code flow | Industry-standard for SaaS. User clicks "Connect CM360" → Google consent screen → redirect back. Token refresh handled server-side. |
| **Claude integration** | Backend calls Claude API directly with tool use | Claude reasons about what to do, backend executes CM360 calls directly — no round-trip to browser needed |
| **Claude model** | Sonnet 4.5 default, Opus for complex reasoning | 90% of requests on cheaper model, Opus for ambiguous IO parsing or error recovery |
| **IO parsing** | Claude's multimodal capabilities (PDF/image) + structured extraction | Claude reads the IO directly, extracts structured data via tool use |
| **State management** | Server-side database (conversations, user prefs, OAuth tokens) | Conversations persist across sessions, team features possible, proper audit trail |
| **CM360 API version** | v5 (v4 sunsets Feb 26, 2026) | Non-negotiable. All code targets v5. |

### Tech Stack

| Layer | Technology |
|---|---|
| **Web app** | React 19, TypeScript 5.3+, Vite |
| **Web app routing** | React Router (or Next.js if SSR needed later) |
| **Companion extension** | Chrome Extension Manifest V3 (minimal — content script + popup) |
| **Backend** | Node.js + Express (or Hono) |
| **CM360 client** | `@googleapis/dfareporting` v17+ (server-side) |
| **Claude integration** | `@anthropic-ai/sdk` with tool use |
| **Database** | PostgreSQL (users, sessions, encrypted OAuth tokens, conversation history) |
| **Auth** | Better Auth or custom JWT + Google OAuth2 for CM360 |
| **Billing** | Stripe |
| **Validation** | Zod (shared schemas between frontend and backend) |
| **Deployment** | Vercel (frontend), Railway/Render/Fly.io (backend + DB) |

### Data Flow: IO-to-Campaign

```
1. User opens app.adtraffic.ai and drops IO file into Kiki chat
   (or clicks companion extension in CM360, which opens web app with context)
2. Web app uploads file to backend:
   POST /api/chat { message: "Parse this IO", file: <base64 PDF>, conversationId }
3. Backend forwards to Claude API with tool definitions:
   - parse_io (extract structured data from document)
   - list_advertisers, list_campaigns, list_sites, etc. (CM360 read ops)
   - create_campaign, create_placement, create_ad, etc. (CM360 write ops)
4. Claude responds with tool calls: parse_io({ file: <base64> })
5. Backend executes the tool, returns parsed IO data to Claude
6. Claude formulates questions, backend streams response to web app
7. ... multi-turn conversation (user answers, backend relays to Claude) ...
8. Claude issues tool calls: create_campaign({...}), create_placement({...}), ...
9. Backend executes CM360 API calls server-side using user's stored OAuth token
10. Backend returns results to Claude
11. Claude formulates success message
12. Backend streams final response + tag data to web app
13. User sees "Done! Here are your tags" with copy-friendly output
```

**Key difference from extension-only architecture:** In step 9, CM360 API calls happen on our server, not in the browser. This means:
- We can run bulk operations in the background (user can close the tab)
- We have a full server-side audit trail of every CM360 operation
- We can enforce RBAC (junior traffickers can read but not write)
- We can rate-limit and queue operations intelligently
- **Tradeoff:** Campaign data transits our servers. Mitigated by encryption at rest, SOC 2 compliance path, and Data Processing Agreements for enterprise clients.

---

## CM360 API Coverage — v1

### Required Resources (must work for v1 launch)

| Resource | Operations Needed | Phase |
|---|---|---|
| `userProfiles` | list | Auth validation |
| `advertisers` | list, get | Advertiser selection |
| `campaigns` | list, get, insert, patch | Campaign CRUD |
| `advertiserLandingPages` | list, get, insert, patch | Landing page management |
| `sites` | list, get | Site lookup |
| `directorySites` | list | Publisher directory search |
| `sizes` | list | Size validation |
| `placements` | list, get, insert, patch, generatetags | Core trafficking |
| `placementGroups` | list, get, insert, patch | Package management |
| `ads` | list, get, insert, patch | Ad creation and creative linking |
| `creatives` | list, get, patch | Creative lookup and update |
| `campaignCreativeAssociations` | list, insert | Creative-campaign linking |

### Not Required for v1

`floodlightActivities`, `floodlightActivityGroups`, `floodlightConfigurations`, `eventTags`, `conversions`, `reports`, `reports.files`, `reports.compatibleFields`, `remarketingLists`, `accountUserProfiles`, `userRoles`, `changeLogs`, `billingProfiles`, `billingAssignments`, `tvCampaignDetails`, `tvCampaignSummaries`, all reference/lookup resources beyond `sizes`

---

## IAB Compliance — v1 Scope

### Do Now (built into v1 architecture)
- **AdCP alignment:** Use IAB content taxonomy and ad product taxonomy in data models where they overlap with CM360 fields
- **AI transparency:** Every Kiki response that executes a write operation includes a clear indicator that this was performed by an AI agent
- **Minimal data retention:** Campaign data transits our servers for API execution but is not persisted beyond the request lifecycle. OAuth tokens stored encrypted. Conversation logs retained per policy (90 days default).
- **Audit-ready output:** Every write operation logged server-side with full receipt: who requested, what was created, API response. Available for compliance export.

### Do Before Enterprise Sales
- Register on IAB Agent Registry
- Prepare machine-readable agent capability manifest
- Document regulatory compliance posture (GDPR, CCPA, EU AI Act)
- VAST compliance verification for video tag generation

### Do Later
- Full ARTF compliance (if expanding to programmatic execution)
- OpenTelemetry integration
- UCP compliance (not applicable to trafficking)

---

## Security Requirements

| Requirement | Implementation |
|---|---|
| **CM360 OAuth tokens** | Stored server-side, encrypted at rest (AES-256). Obtained via standard Google OAuth2 authorization code flow. Refresh tokens rotated. Never sent to the frontend. |
| **Campaign data** | Transits our backend for CM360 API calls. Never persisted beyond the API call lifecycle. Logs contain operation metadata (resource type, count) but not campaign content. |
| **Claude API key** | Stored on backend only. Never exposed to frontend or extension. |
| **User authentication** | JWT-based session auth. Login via email/password or Google SSO. |
| **Conversation data** | Stored server-side (encrypted) for conversation continuity. Retention policy: 90 days default, configurable per enterprise client. |
| **Confirm before mutating** | Every write operation shows a preview and requires explicit approval. |
| **Input validation** | All tool inputs validated with Zod on backend before CM360 API calls. |
| **Rate limiting** | Respect CM360's 100 queries/100 seconds. Server-side queue and pace for bulk operations. |
| **Error handling** | Clear, actionable error messages. Never expose raw API errors, stack traces, or internal state. |
| **RBAC** | Three server-side roles, enforced by per-permission middleware: **admin** (full write, user management, approves others), **senior** (full write, approves others, no user management), **junior** (reads and submits writes to the approval queue — no direct writes). |
| **Audit trail** | Every CM360 write operation logged server-side: who, what, when, result. Available for enterprise compliance export. |
| **SOC 2 path** | Architecture designed for SOC 2 Type II from day one: encrypted data, access controls, audit logging, incident response procedures. Certification targeted pre-enterprise sales. |
| **Companion extension** | Minimal permissions: `activeTab` (detect CM360 pages), `storage` (user preferences). No `identity`, no `host_permissions`. All sensitive operations happen on the web app/backend. |

---

## Success Criteria

### v1 Launch Criteria
1. A trafficker can upload an IO (PDF or Excel) and Kiki correctly parses placement details
2. Kiki can create a full campaign structure in CM360 from an IO in a single conversation
3. All write operations show a preview before execution
4. Tag generation works for all standard placement types
5. Bulk rename works for 50+ items in a single operation
6. Creative assignment works for display and video placements
7. Placement groups/packages can be created and populated
8. Web app works on Chrome, Safari, and Firefox (modern versions)
9. CM360 API calls execute successfully against a live CM360 account
10. Average IO-to-campaign build time is under 5 minutes (vs. 30-90 minutes manual)
11. Companion Chrome extension detects CM360 pages and launches web app with context

### Business Criteria
1. 5 beta users at agencies providing feedback before public launch
2. Web app deployed and accessible at app.adtraffic.ai
3. Companion extension in Chrome Web Store (lightweight, easy approval)
4. Stripe billing integration working for $499/user/month
5. Enterprise tier ($2,500+/month) available with custom invoicing
6. Landing page at adtraffic.ai converting signups
7. Google OAuth app verification for CM360 write scopes

---

## Open Questions

1. **CM360 test account access** — In progress. Needed before any API validation. Single biggest blocker.
2. **Google OAuth app verification** — Write-access apps require Google's security review. Timeline unknown. Need to start this process early. Now more standard since we're a web app (not extension-only).
3. **IO format variability** — How standardized are IOs across publishers? Need to collect sample IOs from different publishers (ESPN, CNN, Vox, etc.) to test Kiki's parsing accuracy.
4. **Database choice** — PostgreSQL is the plan. Need to decide on hosting (Supabase, Neon, Railway, self-managed). Affects deployment architecture.
5. **Auth framework** — Better Auth vs. custom JWT + Google OAuth2. Better Auth gives us email/password, OAuth, magic links out of the box. Need to evaluate.
6. **Pricing validation** — $499/user/month feels right but hasn't been tested. Plan a willingness-to-pay survey with 10-15 agency contacts before launch.
7. **Kiki's personality and tone** — How should Kiki communicate? Professional and concise? Friendly and conversational? Need to define the voice.
8. **SOC 2 timeline** — Now that campaign data transits our servers, SOC 2 Type II becomes important for enterprise sales. Need to scope and plan.
9. **Deployment architecture** — Vercel for frontend, Railway/Render for backend + DB? Or all-in-one on a single platform? Affects cost and complexity.

---

## Revision History

| Date | Version | Changes |
|---|---|---|
| 2026-02-09 | 1.0 | Initial PRD. Chrome extension-only architecture. Approved by founder. |
| 2026-02-09 | 2.0 | Architecture pivot: web platform + companion Chrome extension. CM360 calls move server-side. Added database, auth, RBAC, audit trail, SOC 2 path. Approved by founder. |
