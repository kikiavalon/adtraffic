# AdTraffic.ai — Agent Capability Manifest

**Version:** 1.0.0
**Last Updated:** March 9, 2026
**Status:** Draft — for review before implementation

---

## Purpose

This document describes the machine-readable agent manifest for AdTraffic.ai's Kiki AI assistant. The manifest serves three purposes:

1. **IAB Agent Registry compliance** — required for enterprise sales; describes our agent's capabilities in a discoverable format
2. **Interoperability** — enables other systems and agents to understand what Kiki can do
3. **Transparency** — provides a public, auditable description of our AI system's scope and guardrails

The manifest will be served at `GET /api/v1/agent/manifest` (public, no authentication required).

---

## Manifest Schema

```json
{
  "$schema": "https://adtraffic.ai/schemas/agent-manifest/v1.json",
  "name": "AdTraffic.ai Kiki",
  "version": "1.0.0",
  "vendor": {
    "name": "AdTraffic.ai",
    "url": "https://adtraffic.ai",
    "contact": "support@adtraffic.ai",
    "security_contact": "security@adtraffic.ai",
    "privacy_contact": "privacy@adtraffic.ai"
  },
  "description": "AI-powered assistant for Google Campaign Manager 360 ad trafficking. Reads and writes campaign data through natural language conversation.",
  "agent_type": "conversational_assistant",
  "maturity": "beta",

  "ai_system": {
    "disclosure": true,
    "provider": "Anthropic",
    "model_family": "Claude",
    "model_id": "claude-haiku-4-5",
    "interaction_mode": "conversational",
    "tool_use": true,
    "autonomous_actions": false,
    "human_in_the_loop": true,
    "explanation": "Kiki interprets natural language requests and executes CM360 API operations. All write operations require explicit user confirmation before execution. The AI does not take autonomous actions — every mutating operation is gated by a confirmation step."
  },

  "platform": {
    "name": "Google Campaign Manager 360",
    "api_version": "v5",
    "api_base_url": "https://dfareporting.googleapis.com/dfareporting/v5/",
    "auth_method": "oauth2_authorization_code",
    "oauth_scopes": [
      "https://www.googleapis.com/auth/dfatrafficking",
      "https://www.googleapis.com/auth/dfareporting"
    ]
  },

  "capabilities": {
    "tool_count": 70,
    "categories": {
      "campaign_management": {
        "description": "Create, read, update campaigns",
        "operations": ["list", "get", "create", "update"],
        "tools": [
          "cm360_list_campaigns",
          "cm360_get_campaign",
          "cm360_create_campaign",
          "cm360_update_campaign"
        ]
      },
      "placement_management": {
        "description": "Create, read, update placements and placement groups",
        "operations": ["list", "get", "create", "update"],
        "tools": [
          "cm360_list_placements",
          "cm360_get_placement",
          "cm360_create_placement",
          "cm360_update_placement",
          "cm360_list_placement_groups",
          "cm360_get_placement_group",
          "cm360_create_placement_group",
          "cm360_update_placement_group"
        ]
      },
      "creative_management": {
        "description": "Create, read, update creatives and creative-campaign associations",
        "operations": ["list", "get", "create", "update", "upload"],
        "tools": [
          "cm360_list_creatives",
          "cm360_get_creative",
          "cm360_create_creative",
          "cm360_update_creative",
          "cm360_upload_creative_asset",
          "cm360_associate_creative_campaign",
          "cm360_list_campaign_creative_associations"
        ]
      },
      "ad_management": {
        "description": "Create, read, update ads (links creatives to placements)",
        "operations": ["list", "get", "create", "update"],
        "tools": [
          "cm360_list_ads",
          "cm360_get_ad",
          "cm360_create_ad",
          "cm360_update_ad"
        ]
      },
      "tag_generation": {
        "description": "Generate ad serving tags for placements",
        "operations": ["generate"],
        "tools": ["cm360_generate_tags"]
      },
      "floodlight_tracking": {
        "description": "Manage floodlight conversion tracking activities, groups, and configurations",
        "operations": ["list", "get", "create", "generate"],
        "tools": [
          "cm360_list_floodlight_activities",
          "cm360_get_floodlight_activity",
          "cm360_create_floodlight_activity",
          "cm360_list_floodlight_activity_groups",
          "cm360_get_floodlight_activity_group",
          "cm360_create_floodlight_activity_group",
          "cm360_list_floodlight_configurations",
          "cm360_generate_floodlight_tag"
        ]
      },
      "reporting": {
        "description": "Create, run, and download CM360 reports",
        "operations": ["list", "get", "create", "run", "download", "query"],
        "tools": [
          "cm360_list_reports",
          "cm360_get_report",
          "cm360_create_report",
          "cm360_run_report",
          "cm360_get_report_file",
          "cm360_query_compatible_fields"
        ]
      },
      "event_tags": {
        "description": "Manage impression and click tracking pixels",
        "operations": ["list", "get", "create", "update", "delete"],
        "tools": [
          "cm360_list_event_tags",
          "cm360_get_event_tag",
          "cm360_create_event_tag",
          "cm360_update_event_tag",
          "cm360_delete_event_tag"
        ]
      },
      "user_role_management": {
        "description": "Manage account user profiles, roles, and permissions",
        "operations": ["list", "get", "create"],
        "tools": [
          "cm360_list_account_user_profiles",
          "cm360_get_account_user_profile",
          "cm360_create_account_user_profile",
          "cm360_list_user_roles",
          "cm360_get_user_role",
          "cm360_create_user_role",
          "cm360_get_user_role_permission",
          "cm360_list_user_role_permissions",
          "cm360_get_user_role_permission_group",
          "cm360_list_user_role_permission_groups",
          "cm360_list_subaccounts",
          "cm360_get_subaccount"
        ]
      },
      "site_management": {
        "description": "Manage sites, directory sites, landing pages, and ad sizes",
        "operations": ["list", "get", "create", "update"],
        "tools": [
          "cm360_list_sites",
          "cm360_get_site",
          "cm360_list_directory_sites",
          "cm360_get_directory_site",
          "cm360_insert_directory_site",
          "cm360_list_landing_pages",
          "cm360_get_landing_page",
          "cm360_create_landing_page",
          "cm360_update_landing_page",
          "cm360_list_sizes"
        ]
      },
      "audit_trail": {
        "description": "Read-only access to CM360 change logs",
        "operations": ["list", "get"],
        "tools": [
          "cm360_list_change_logs",
          "cm360_get_change_log"
        ]
      },
      "analysis": {
        "description": "Campaign pacing and delivery analysis",
        "operations": ["analyze"],
        "tools": ["cm360_pacing_analysis"]
      },
      "account_management": {
        "description": "Read account profiles and advertisers",
        "operations": ["list", "get"],
        "tools": [
          "cm360_list_profiles",
          "cm360_list_advertisers",
          "cm360_get_advertiser"
        ]
      }
    },
    "write_safety": {
      "confirmation_required": true,
      "preview_before_execute": true,
      "description": "All create, update, and delete operations require explicit user confirmation before execution. The AI previews what will happen and asks for approval."
    }
  },

  "data_processing": {
    "campaign_data_retention": "transient_in_pending_actions_qa_runs_and_conversation_logs",
    "campaign_data_stored": true,
    "campaign_data_explanation": "CM360 campaign data transits the server for API execution and is not cached or used for advertising. Campaign details appear in stored conversation logs, and pending write actions and QA runs temporarily retain the campaign fields they operate on.",
    "conversation_retention": "until_deleted_no_automatic_purge",
    "oauth_token_storage": "encrypted_at_rest_aes256gcm",
    "training_data_usage": "never",
    "training_data_explanation": "Customer data, including CM360 campaign data and conversation content, is never used to train, fine-tune, or improve any machine learning models, AI systems, or algorithms. This applies to both AdTraffic.ai's systems and third-party AI providers.",
    "third_party_processors": [
      {
        "name": "Anthropic",
        "service": "Claude AI",
        "data_shared": "User chat messages and CM360 tool results (within conversation context)",
        "purpose": "Generate AI responses and determine which CM360 tools to invoke",
        "data_retained_by_processor": false,
        "notes": "Anthropic does not use API inputs/outputs for model training per their API terms"
      },
      {
        "name": "Google Cloud",
        "service": "Cloud Run, Cloud SQL, Secret Manager",
        "data_shared": "Application data (user accounts, encrypted OAuth tokens, conversation logs)",
        "purpose": "Infrastructure hosting",
        "data_retained_by_processor": false
      },
      {
        "name": "Sentry",
        "service": "Error reporting",
        "data_shared": "Error events with PII redacted (auth headers, cookies, passwords, tokens scrubbed before transmission)",
        "purpose": "Application error monitoring",
        "data_retained_by_processor": true,
        "notes": "90-day retention per Sentry's default policy"
      }
    ]
  },

  "compliance": {
    "eu_ai_act_article_50": {
      "status": "compliant",
      "measures": [
        "Persistent AI disclosure badge in chat UI",
        "Welcome message explicitly identifies Kiki as an AI assistant",
        "System prompt requires AI self-identification when asked",
        "Machine-readable AI attribution on generated outputs (tag code, reports)",
        "AI disclosure on login, registration, and settings pages"
      ]
    },
    "gdpr": {
      "status": "aware",
      "measures": [
        "Minimal data collection (only what's needed for service)",
        "Data export, account deletion, and erasure are operator-assisted on a self-hosted instance; in-app self-service is not yet implemented"
      ]
    },
    "ccpa": {
      "status": "aware",
      "measures": [
        "Do not sell personal information",
        "Right to know what data is collected (disclosed in the privacy policy)",
        "Deletion of personal data is operator-assisted; in-app self-service is not yet implemented",
        "Right to opt-out (account disconnection)"
      ]
    },
    "iab_agent_registry": {
      "status": "pending_registration",
      "agent_type": "MCP",
      "agent_category": "Campaign Management",
      "mcp_implementation": "@adtraffic/mcp — shipped stdio Model Context Protocol server, run from a local checkout via `node mcp/dist/index.js` (npm publishing / `npx @adtraffic/mcp` on the roadmap), exposing all 70 CM360 tools against seeded demo data (@adtraffic/shared/mock-cm360)"
    },
    "soc2_type2": {
      "status": "in_progress",
      "target_date": "2026-Q4"
    }
  },

  "security": {
    "authentication": {
      "user_auth": "JWT with bcrypt password hashing, HS256 algorithm pinning",
      "cm360_auth": "Google OAuth2 authorization code flow",
      "token_encryption": "AES-256-GCM for OAuth tokens at rest"
    },
    "infrastructure": {
      "hosting": "Google Cloud Platform (Cloud Run, Cloud SQL, Secret Manager)",
      "region": "us-central1",
      "encryption_in_transit": "TLS enforced",
      "encryption_at_rest": "Google-managed keys (Cloud SQL) + AES-256-GCM (application layer)",
      "container_security": "Non-root users, read-only filesystem, resource limits",
      "secrets_management": "Google Secret Manager (no .env files in containers)"
    },
    "application": {
      "input_validation": "Zod schemas on all 70 tool inputs and API endpoints",
      "rate_limiting": "Per-endpoint sliding window (auth: 10/min, chat: 20/min, register: 5/min)",
      "error_handling": "Structured logging via Pino, PII redaction, no stack traces in production",
      "dependency_management": "All dependencies pinned to exact versions",
      "ci_cd": "GitHub Actions (lint, typecheck, 1660 tests, security audit, Docker build)"
    },
    "vulnerability_disclosure": "https://github.com/kikiavalon/adtraffic/blob/main/SECURITY.md",
    "security_contact": "security@adtraffic.ai"
  },

  "health": {
    "liveness": "/health/live",
    "readiness": "/health/ready",
    "full_status": "/health"
  },

  "links": {
    "homepage": "https://adtraffic.ai",
    "app": "https://app.adtraffic.ai",
    "privacy_policy": "https://app.adtraffic.ai/privacy",
    "security_policy": "https://github.com/kikiavalon/adtraffic/blob/main/SECURITY.md",
    "documentation": "https://adtraffic.ai/docs",
    "status": "https://status.adtraffic.ai"
  }
}
```

---

## Field Explanations

### `ai_system`

| Field | Value | Why |
|---|---|---|
| `disclosure` | `true` | EU AI Act Article 50 requires AI systems to disclose they are AI |
| `autonomous_actions` | `false` | Kiki never takes action without user confirmation |
| `human_in_the_loop` | `true` | All write operations gated by confirmation flow |
| `tool_use` | `true` | Kiki uses Claude's tool_use to invoke CM360 API operations |

### `data_processing`

Modeled after Improvado's AI Data Processing Addendum pattern. Key commitments:

| Commitment | Detail |
|---|---|
| **Campaign data storage** | CM360 data that appears in a conversation is persisted (chat history, pending-action and approval-queue payloads, QA runs) as plaintext; only OAuth tokens and API keys are encrypted at rest |
| **No training on customer data** | Customer data never used to train, fine-tune, or improve any AI models |
| **Encrypted OAuth tokens** | AES-256-GCM encryption at rest, transmitted only over TLS |
| **Conversation retention** | No automatic retention window; conversations persist until a user deletes them. QA runs default to 30-day retention |
| **Data deletion** | Users can delete individual conversations and disconnect credentials in-app. Full account deletion and erasure are operator-assisted on a self-hosted instance; in-app self-service is not yet implemented |

### `data_processing.third_party_processors`

Inspired by Improvado's component-level data sharing table. Documents exactly what data flows to each third party and why.

### `capabilities.write_safety`

Critical for enterprise buyers. Documents that every mutating operation (create, update, delete) requires:
1. **Preview** — Kiki shows what will happen before executing
2. **Confirmation** — User must explicitly approve
3. **Audit trail** — Operation logged with who, what, when, result

### `compliance`

Maps to the regulatory frameworks identified in our IAB compliance plan:
- EU AI Act Article 50 (mandatory by August 2, 2026)
- GDPR (extraterritorial — triggered by EU-headquartered clients like Publicis)
- CCPA (California residents)
- IAB Agent Registry (enterprise credibility)
- SOC 2 Type II (enterprise procurement requirement)

---

## Serving the Manifest

**Endpoint:** `GET /api/v1/agent/manifest`
- Public (no authentication required)
- Returns `Content-Type: application/json`
- Cached with `Cache-Control: public, max-age=3600` (1 hour)

**Companion endpoint:** `GET /api/v1/agent/tools`
- Public (no authentication required)
- Returns the list of 70 tools with names, descriptions, and categories
- Useful for other systems discovering our agent's capabilities

---

## Notes for Legal Review

1. The `training_data_explanation` language is modeled after Improvado's Customer Data Usage clause. Have legal confirm this commitment is sustainable given our Anthropic API terms.
2. Conversations currently have no automatic retention window (they persist until manually deleted); a defined retention policy should be added and validated against GDPR data minimization requirements.
3. The `data_retained_by_processor: false` claim for Anthropic should be verified against their current API data handling terms.
4. SOC 2 Type II target date (2026-Q4) should be validated with the compliance team.
5. Privacy policy URL and security policy URL should be live before this manifest is published.
