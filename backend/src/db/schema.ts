import { pgTable, text, timestamp, uuid, bigint, unique, index, customType } from 'drizzle-orm/pg-core';

/**
 * Database schema for AdTraffic.ai
 *
 * Uses Drizzle ORM with PostgreSQL.
 */

/** Users table — AdTraffic.ai accounts */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'senior', 'junior'] }).notNull().default('senior'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Conversations table — chat sessions */
export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: text('title'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Messages table — individual chat messages */
export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
});

/** Feature flag overrides — per-user flag customization */
export const featureFlagOverrides = pgTable('feature_flag_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  flagName: text('flag_name').notNull(),
  value: text('value').notNull(), // JSON-encoded boolean or number
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueUserFlag: unique().on(table.userId, table.flagName),
}));

/** Audit logs — compliance-grade interaction tracking */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  /** Conversation ID (no FK — intentional: audit records must survive conversation deletion for compliance) */
  conversationId: text('conversation_id'),
  sessionId: text('session_id'),
  /** Event type: message_sent, message_received, tool_executed, etc. */
  eventType: text('event_type').notNull(),
  /** Structured metadata (tool name, input/output, error details, etc.) — JSON string */
  metadata: text('metadata').notNull(),
  /** IP address for compliance (SHA-256 hashed, truncated to 16 chars — never raw) */
  ipHash: text('ip_hash'),
  /** User agent string (truncated to 500 chars) */
  userAgent: text('user_agent'),
  /** Timestamp for human-readable queries */
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userCreatedAtIdx: index('audit_logs_user_created_at_idx').on(table.userId, table.createdAt),
  conversationIdx: index('audit_logs_conversation_id_idx').on(table.conversationId),
}));

/** Approval queue — junior user write operations pending senior/admin review */
export const approvalQueue = pgTable('approval_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  requesterId: uuid('requester_id').notNull().references(() => users.id),
  approverId: uuid('approver_id').references(() => users.id), // null until approved/rejected
  conversationId: text('conversation_id'),
  /** Pending action details (serialized PendingAction) */
  actionPayload: text('action_payload').notNull(), // JSON string
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'expired'] }).notNull().default('pending'),
  /** Outcome of executing the approved action (serialized {result, isError, errorMessage, executedAt}) */
  executionResult: text('execution_result'), // JSON string, null until executed
  /** Approver's note (optional) */
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => ({
  statusIdx: index('approval_queue_status_idx').on(table.status),
  requesterIdx: index('approval_queue_requester_id_idx').on(table.requesterId),
  createdAtIdx: index('approval_queue_created_at_idx').on(table.createdAt),
}));

/** In-flight write confirmations — persisted so pending approvals survive
 * page refreshes, backend restarts, and load-balanced replicas */
export const pendingActions = pgTable('pending_actions', {
  actionId: uuid('action_id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').notNull(),
  /** Serialized StoredPendingAction (PendingAction + toolInput) */
  payload: text('payload').notNull(), // JSON string
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('pending_actions_user_id_idx').on(table.userId),
  expiresIdx: index('pending_actions_expires_at_idx').on(table.expiresAt),
}));

/** Trafficking QA runs — one row per end-of-turn validation (design doc §7).
 * The audit log deliberately strips URLs/names, so QA keeps its own record
 * of what was implemented in `scope`. */
export const qaRuns = pgTable('qa_runs', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id'),
  campaignId: text('campaign_id'),
  advertiserId: text('advertiser_id'),
  trigger: text('trigger', { enum: ['auto', 'manual', 'approval'] }).notNull().default('auto'),
  status: text('status', { enum: ['pending', 'running', 'passed', 'warned', 'failed', 'error'] }).notNull().default('pending'),
  /** JSON: QATouchedEntity[] — the writes this run validates (Phase 2's runner clicks these) */
  scope: text('scope').notNull().default('[]'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  /** Retention boundary (qa.retention_days flag, default 30) — swept opportunistically */
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  userStartedIdx: index('qa_runs_user_started_idx').on(table.userId, table.startedAt),
  conversationIdx: index('qa_runs_conversation_id_idx').on(table.conversationId),
  expiresIdx: index('qa_runs_expires_at_idx').on(table.expiresAt),
}));

/** Drizzle has no built-in bytea — minimal custom type (Buffer in/out). */
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/** Trafficking QA evidence (Phase 2) — click-test screenshots, ~100–300 KB
 * PNG each (design §4 evidence storage). Deleted by the qa_runs retention
 * sweep via cascade. source_key (e.g. `click:ad:2001`) makes persistence
 * idempotent when both backend replicas hear the same QueueEvents completion. */
export const qaEvidence = pgTable('qa_evidence', {
  id: uuid('id').primaryKey(), // app-generated (memory-fallback parity, like qa_runs.id)
  runId: uuid('run_id').notNull().references(() => qaRuns.id, { onDelete: 'cascade' }),
  sourceKey: text('source_key').notNull(),
  contentType: text('content_type').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueRunSource: unique().on(table.runId, table.sourceKey),
  runIdx: index('qa_evidence_run_id_idx').on(table.runId),
}));

/** Individual QA check results — idempotent upserts keyed on (run_id, check_key) */
export const qaChecks = pgTable('qa_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => qaRuns.id, { onDelete: 'cascade' }),
  category: text('category', { enum: ['clickthrough', 'landing', 'tracking', 'config'] }).notNull(),
  checkKey: text('check_key').notNull(),
  status: text('status', { enum: ['pass', 'warn', 'fail', 'skipped'] }).notNull(),
  expected: text('expected'),
  actual: text('actual'),
  /** JSON detail: { message } in Phase 1; Phase 2 adds redirect chains and param diffs */
  detail: text('detail'),
  /** Phase 2: screenshot evidence for click tests (null for config/tracking checks) */
  evidenceId: uuid('evidence_id').references(() => qaEvidence.id, { onDelete: 'set null' }),
}, (table) => ({
  uniqueRunCheck: unique().on(table.runId, table.checkKey),
  runIdx: index('qa_checks_run_id_idx').on(table.runId),
}));

/** OAuth tokens — encrypted CM360 tokens (future) */
export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id).unique(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  scopes: text('scopes').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Anthropic API credentials — encrypted per-user Claude API keys */
export const anthropicCredentials = pgTable('anthropic_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  last4: text('last4').notNull(),
  verifiedAt: timestamp('verified_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
