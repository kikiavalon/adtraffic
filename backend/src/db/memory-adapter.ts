/**
 * In-memory database adapter for DEMO_MODE.
 *
 * Replaces PostgreSQL+Drizzle with Map-backed storage.
 * Supports the exact Drizzle query patterns used across the codebase
 * (19 patterns audited — see implementation plan).
 *
 * Data persists for the server lifetime only (lost on restart).
 */

import crypto from 'crypto';
import * as schema from './schema.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Table Storage — one Map per table, keyed by primary key
// ---------------------------------------------------------------------------

type TableName = 'users' | 'conversations' | 'messages' | 'oauthTokens' | 'featureFlagOverrides';

// Each Map stores records as plain objects with camelCase property names
// matching the Drizzle schema definitions (not the snake_case DB columns).
const tables: Record<TableName, Map<string, Record<string, unknown>>> = {
  users: new Map(),
  conversations: new Map(),
  messages: new Map(),
  oauthTokens: new Map(),
  featureFlagOverrides: new Map(),
};

// Map schema table objects to their storage Map + table name
const tableRegistry = new Map<unknown, { name: TableName; pkField: string; autoId: boolean }>([
  [schema.users, { name: 'users', pkField: 'id', autoId: true }],
  [schema.conversations, { name: 'conversations', pkField: 'id', autoId: false }],
  [schema.messages, { name: 'messages', pkField: 'id', autoId: false }],
  [schema.oauthTokens, { name: 'oauthTokens', pkField: 'id', autoId: true }],
  [schema.featureFlagOverrides, { name: 'featureFlagOverrides', pkField: 'id', autoId: true }],
]);

function getTable(schemaTable: unknown): { map: Map<string, Record<string, unknown>>; meta: { name: TableName; pkField: string; autoId: boolean } } {
  const meta = tableRegistry.get(schemaTable);
  if (!meta) throw new Error(`Unknown table in memory adapter`);
  return { map: tables[meta.name], meta };
}

// ---------------------------------------------------------------------------
// Condition evaluation — supports eq() and and(eq(), eq())
// ---------------------------------------------------------------------------

// Drizzle's eq()/and()/desc()/asc() return SQL objects with queryChunks arrays.
// We identify Drizzle object types by their properties (not symbols):
//   Column  → has `columnType` and `name` properties
//   SQL     → has `queryChunks` array property
//   Param   → has `value` property, no `columnType`, no `queryChunks`
//   StringChunk → has `value` property (string[]), no `columnType`

function isColumn(chunk: unknown): chunk is { columnType: string; name: string } {
  const c = chunk as Record<string, unknown>;
  return c?.columnType !== undefined && typeof c?.name === 'string';
}

function isSQL(chunk: unknown): chunk is { queryChunks: unknown[] } {
  const c = chunk as Record<string, unknown>;
  return Array.isArray(c?.queryChunks);
}

function isStringChunk(chunk: unknown): boolean {
  const c = chunk as Record<string, unknown>;
  return c?.value !== undefined && Array.isArray(c.value) &&
    (c.value as unknown[]).every((v: unknown) => typeof v === 'string');
}

function isParam(chunk: unknown): chunk is { value: unknown } {
  return !isColumn(chunk) && !isSQL(chunk) && !isStringChunk(chunk) &&
    (chunk as Record<string, unknown>)?.value !== undefined;
}

/** Map from snake_case DB column names to camelCase schema property names */
const columnNameMap: Record<string, string> = {
  id: 'id',
  email: 'email',
  password_hash: 'passwordHash',
  name: 'name',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  user_id: 'userId',
  title: 'title',
  conversation_id: 'conversationId',
  role: 'role',
  content: 'content',
  timestamp: 'timestamp',
  flag_name: 'flagName',
  value: 'value',
  access_token: 'accessToken',
  refresh_token: 'refreshToken',
  expires_at: 'expiresAt',
  scopes: 'scopes',
};

function snakeToCamel(snakeName: string): string {
  return columnNameMap[snakeName] ?? snakeName;
}

/** Extract column name and value from a Drizzle eq() condition.
 *  eq() queryChunks: [StringChunk(''), Column, StringChunk(' = '), Param, StringChunk('')]
 */
function parseEqCondition(condition: unknown): { field: string; value: unknown } | null {
  const cond = condition as Record<string, unknown>;
  const chunks = cond?.queryChunks as unknown[] | undefined;
  if (!chunks || chunks.length < 3) return null;

  let columnName: string | null = null;
  let paramValue: unknown = undefined;
  let foundColumn = false;

  for (const chunk of chunks) {
    if (!foundColumn && isColumn(chunk)) {
      columnName = chunk.name;
      foundColumn = true;
    } else if (foundColumn && isParam(chunk)) {
      paramValue = (chunk as { value: unknown }).value;
      break;
    }
  }

  if (columnName !== null && paramValue !== undefined) {
    return { field: snakeToCamel(columnName), value: paramValue };
  }
  return null;
}

/** Parse a where condition — supports eq() and and(eq(), eq()).
 *  eq() is an SQL with queryChunks containing Column + Param.
 *  and() is an SQL wrapping an inner SQL whose queryChunks join sub-conditions with ' and '.
 */
function parseCondition(condition: unknown): Array<{ field: string; value: unknown }> {
  if (!condition) return [];

  // Try as a single eq() first
  const single = parseEqCondition(condition);
  if (single) return [single];

  // Check if it's a compound condition (and())
  if (!isSQL(condition)) return [];

  const chunks = (condition as { queryChunks: unknown[] }).queryChunks;
  const conditions: Array<{ field: string; value: unknown }> = [];

  for (const chunk of chunks) {
    // Try parsing this chunk directly as eq()
    const parsed = parseEqCondition(chunk);
    if (parsed) {
      conditions.push(parsed);
    } else if (isSQL(chunk)) {
      // Nested SQL — recurse into its queryChunks (e.g., and() inner SQL)
      const innerChunks = (chunk as { queryChunks: unknown[] }).queryChunks;
      for (const innerChunk of innerChunks) {
        const innerParsed = parseEqCondition(innerChunk);
        if (innerParsed) {
          conditions.push(innerParsed);
        }
      }
    }
  }

  return conditions;
}

/** Test whether a record matches all conditions */
function matchesConditions(record: Record<string, unknown>, conditions: Array<{ field: string; value: unknown }>): boolean {
  return conditions.every(({ field, value }) => record[field] === value);
}

// ---------------------------------------------------------------------------
// Column projection — extract specific fields from select({cols})
// ---------------------------------------------------------------------------

function projectColumns(record: Record<string, unknown>, projection: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!projection) return { ...record };

  const result: Record<string, unknown> = {};
  for (const [alias, colRef] of Object.entries(projection)) {
    if (isColumn(colRef)) {
      const camelName = snakeToCamel(colRef.name);
      result[alias] = record[camelName];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Order extraction — parse orderBy(asc/desc(col))
// ---------------------------------------------------------------------------

interface OrderSpec {
  field: string;
  direction: 'asc' | 'desc';
}

/** Parse orderBy — desc(col) or asc(col).
 *  desc() queryChunks: [StringChunk(''), Column, StringChunk(' desc')]
 *  asc()  queryChunks: [StringChunk(''), Column, StringChunk(' asc')]
 */
function parseOrderBy(orderByArg: unknown): OrderSpec | null {
  if (!orderByArg) return null;

  const chunks = (orderByArg as Record<string, unknown>)?.queryChunks as unknown[] | undefined;
  if (!Array.isArray(chunks)) return null;

  let field: string | null = null;
  let hasDesc = false;

  for (const chunk of chunks) {
    if (isColumn(chunk)) {
      field = snakeToCamel(chunk.name);
    } else {
      // Check StringChunk/Param values for 'desc' direction indicator
      const c = chunk as Record<string, unknown>;
      if (c?.value !== undefined) {
        const val = c.value;
        const str = Array.isArray(val) ? (val as string[]).join('') : `${val as string | number}`;
        if (str.toLowerCase().includes('desc')) {
          hasDesc = true;
        }
      }
    }
  }

  if (field) {
    return { field, direction: hasDesc ? 'desc' : 'asc' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Builder classes — chainable, thenable (await triggers execution)
// ---------------------------------------------------------------------------

class SelectBuilder {
  private _projection: Record<string, unknown> | undefined;
  private _table: unknown;
  private _where: unknown;
  private _orderBy: unknown;
  private _limit: number | undefined;
  private _offset: number | undefined;

  constructor(projection?: Record<string, unknown>) {
    this._projection = projection;
  }

  from(table: unknown): this {
    this._table = table;
    return this;
  }

  where(condition: unknown): this {
    this._where = condition;
    return this;
  }

  orderBy(order: unknown): this {
    this._orderBy = order;
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  offset(n: number): this {
    this._offset = n;
    return this;
  }

  then<TResult1 = Record<string, unknown>[], TResult2 = never>(
    resolve?: ((value: Record<string, unknown>[]) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const { map } = getTable(this._table);
      const conditions = parseCondition(this._where);
      let results = [...map.values()];

      // Filter
      if (conditions.length > 0) {
        results = results.filter(r => matchesConditions(r, conditions));
      }

      // Order
      const order = parseOrderBy(this._orderBy);
      if (order) {
        results.sort((a, b) => {
          const aVal = a[order.field];
          const bVal = b[order.field];
          if (aVal instanceof Date && bVal instanceof Date) {
            return order.direction === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
          }
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return order.direction === 'asc' ? aVal - bVal : bVal - aVal;
          }
          const aStr = `${(aVal ?? '') as string | number}`;
          const bStr = `${(bVal ?? '') as string | number}`;
          return order.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        });
      }

      // Paginate
      if (this._offset !== undefined) {
        results = results.slice(this._offset);
      }
      if (this._limit !== undefined) {
        results = results.slice(0, this._limit);
      }

      // Project
      results = results.map(r => projectColumns(r, this._projection));

      return resolve ? Promise.resolve(resolve(results)) : Promise.resolve(results) as Promise<TResult1 | TResult2>;
    } catch (err) {
      return reject ? Promise.resolve(reject(err)) : Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

class InsertBuilder {
  private _table: unknown;
  private _values: Record<string, unknown> | undefined;
  private _returningProjection: Record<string, unknown> | undefined;
  private _onConflict: 'nothing' | { target: unknown[]; set: Record<string, unknown> } | undefined;

  constructor(table: unknown) {
    this._table = table;
  }

  values(vals: Record<string, unknown>): this {
    this._values = vals;
    return this;
  }

  returning(projection: Record<string, unknown>): this {
    this._returningProjection = projection;
    return this;
  }

  onConflictDoNothing(): this {
    this._onConflict = 'nothing';
    return this;
  }

  onConflictDoUpdate(config: { target: unknown[]; set: Record<string, unknown> }): this {
    this._onConflict = config;
    return this;
  }

  then<TResult1 = Record<string, unknown>[], TResult2 = never>(
    resolve?: ((value: Record<string, unknown>[]) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const { map, meta } = getTable(this._table);
      const record = { ...this._values } as Record<string, unknown>;

      // Auto-generate ID if needed
      if (meta.autoId && !record[meta.pkField]) {
        record[meta.pkField] = crypto.randomUUID();
      }

      const pk = String(record[meta.pkField]);

      // Handle conflicts
      if (this._onConflict === 'nothing') {
        // Skip if primary key already exists
        if (map.has(pk)) {
          const result = this._returningProjection
            ? [projectColumns(map.get(pk)!, this._returningProjection)]
            : [];
          return resolve ? Promise.resolve(resolve(result)) : Promise.resolve(result) as Promise<TResult1 | TResult2>;
        }
        // Also check unique constraints
        if (meta.name === 'users') {
          const emailConflict = [...map.values()].find(r => r.email === record.email);
          if (emailConflict) {
            return resolve ? Promise.resolve(resolve([])) : Promise.resolve([]) as Promise<TResult1 | TResult2>;
          }
        }
      } else if (this._onConflict && typeof this._onConflict === 'object') {
        // onConflictDoUpdate — find existing record matching target columns
        const targetFields = (this._onConflict.target as Array<{ name: string }>).map(c => snakeToCamel(c.name));
        const existing = [...map.values()].find(r =>
          targetFields.every(f => r[f] === record[f])
        );
        if (existing) {
          // Update existing record
          const existingPk = String(existing[meta.pkField]);
          const updated = { ...existing, ...this._onConflict.set };
          map.set(existingPk, updated);
          const result = this._returningProjection
            ? [projectColumns(updated, this._returningProjection)]
            : [updated];
          return resolve ? Promise.resolve(resolve(result)) : Promise.resolve(result) as Promise<TResult1 | TResult2>;
        }
      }

      // Check unique email constraint for users
      if (meta.name === 'users') {
        const emailConflict = [...map.values()].find(r => r.email === record.email);
        if (emailConflict) {
          throw new Error('Email already registered');
        }
      }

      map.set(pk, record);

      const result = this._returningProjection
        ? [projectColumns(record, this._returningProjection)]
        : [record];
      return resolve ? Promise.resolve(resolve(result)) : Promise.resolve(result) as Promise<TResult1 | TResult2>;
    } catch (err) {
      return reject ? Promise.resolve(reject(err)) : Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

class UpdateBuilder {
  private _table: unknown;
  private _setValues: Record<string, unknown> | undefined;
  private _where: unknown;

  constructor(table: unknown) {
    this._table = table;
  }

  set(values: Record<string, unknown>): this {
    this._setValues = values;
    return this;
  }

  where(condition: unknown): this {
    this._where = condition;
    return this;
  }

  then<TResult1 = void, TResult2 = never>(
    resolve?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const { map } = getTable(this._table);
      const conditions = parseCondition(this._where);

      for (const [key, record] of map) {
        if (matchesConditions(record, conditions)) {
          map.set(key, { ...record, ...this._setValues });
        }
      }

      return resolve ? Promise.resolve(resolve(undefined as void)) : Promise.resolve(undefined as void) as unknown as Promise<TResult1 | TResult2>;
    } catch (err) {
      return reject ? Promise.resolve(reject(err)) : Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

class DeleteBuilder {
  private _table: unknown;
  private _where: unknown;

  constructor(table: unknown) {
    this._table = table;
  }

  where(condition: unknown): this {
    this._where = condition;
    return this;
  }

  then<TResult1 = void, TResult2 = never>(
    resolve?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const { map, meta } = getTable(this._table);
      const conditions = parseCondition(this._where);

      // Handle cascade deletes for conversations → messages
      const toDelete: string[] = [];
      for (const [key, record] of map) {
        if (matchesConditions(record, conditions)) {
          toDelete.push(key);

          // Cascade: deleting a conversation deletes its messages
          if (meta.name === 'conversations') {
            const convId = record.id as string;
            for (const [msgKey, msg] of tables.messages) {
              if (msg.conversationId === convId) {
                tables.messages.delete(msgKey);
              }
            }
          }

          // Cascade: deleting a user deletes their overrides
          if (meta.name === 'users') {
            const userId = record.id as string;
            for (const [flagKey, flag] of tables.featureFlagOverrides) {
              if (flag.userId === userId) {
                tables.featureFlagOverrides.delete(flagKey);
              }
            }
          }
        }
      }

      for (const key of toDelete) {
        map.delete(key);
      }

      return resolve ? Promise.resolve(resolve(undefined as void)) : Promise.resolve(undefined as void) as unknown as Promise<TResult1 | TResult2>;
    } catch (err) {
      return reject ? Promise.resolve(reject(err)) : Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an in-memory database that mimics the Drizzle ORM API.
 * Starts empty (no seed user) so demo behaves like a real fresh instance.
 */
export function createMemoryDb(): { db: {
  select: (projection?: Record<string, unknown>) => SelectBuilder;
  insert: (table: unknown) => InsertBuilder;
  update: (table: unknown) => UpdateBuilder;
  delete: (table: unknown) => DeleteBuilder;
}; schema: typeof schema } {
  // Clear all tables
  for (const map of Object.values(tables)) {
    map.clear();
  }

  // No seed user: demo starts as a real fresh instance, so the first signup
  // runs the bootstrap flow (creates the workspace admin).
  logger.info('Demo mode: in-memory database initialized (no PostgreSQL required)');

  const db = {
    select: (projection?: Record<string, unknown>) => new SelectBuilder(projection),
    insert: (table: unknown) => new InsertBuilder(table),
    update: (table: unknown) => new UpdateBuilder(table),
    delete: (table: unknown) => new DeleteBuilder(table),
  };

  return { db, schema };
}

/**
 * Create a no-op SQL tagged template that resolves health checks.
 * Returns { end(): Promise<void> } for graceful shutdown compatibility.
 */
export function createNoOpSql(): {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
  end: () => Promise<void>;
} {
  const sql = ((_strings: TemplateStringsArray, ..._values: unknown[]): Promise<Record<string, unknown>[]> => {
    return Promise.resolve([{ '1': 1 }]);
  }) as {
    (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
    end: () => Promise<void>;
  };

  sql.end = () => Promise.resolve();
  return sql;
}
