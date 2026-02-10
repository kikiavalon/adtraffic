import Database from 'better-sqlite3';
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

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export { schema };
