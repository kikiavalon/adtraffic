import { pgTable, text, timestamp, uuid, bigint, unique, index } from 'drizzle-orm/pg-core';

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
  /** Approver's note (optional) */
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => ({
  statusIdx: index('approval_queue_status_idx').on(table.status),
  requesterIdx: index('approval_queue_requester_id_idx').on(table.requesterId),
  createdAtIdx: index('approval_queue_created_at_idx').on(table.createdAt),
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
