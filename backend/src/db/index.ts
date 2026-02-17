/**
 * Database connection module.
 *
 * Schema creation is handled by Drizzle Kit (`drizzle-kit push`) — not by
 * auto-migration at runtime. This is intentional: schema changes are applied
 * explicitly during development or deployment, keeping the runtime startup
 * fast and predictable.
 */

import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// SQLite database file path (in backend/ directory, gitignored)
const DB_PATH = process.env.DATABASE_URL ?? join(__dirname, '../../data/adtraffic.db');

// Ensure the data directory exists
const dataDir = dirname(DB_PATH);
mkdirSync(dataDir, { recursive: true });

/** Raw SQLite connection — exported for graceful shutdown */
export const sqlite: BetterSqlite3.Database = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export { schema };
