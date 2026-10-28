import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { getConfig } from '@/core/config';

import * as schema from './schema';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export interface OpenDatabaseOptions {
  /** A file path, or `:memory:` for tests. */
  readonly file: string;
  readonly migrationsDir: string;
}

/**
 * Opens a database and brings it to the latest schema. Running migrations on start-up is the right
 * trade-off for a local, single-user app: there is no deploy step to forget.
 */
export function openDatabase({ file, migrationsDir }: OpenDatabaseOptions): AppDatabase {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

  const sqlite = new Database(file);
  // WAL lets the web app and the MCP server (two processes) read and write concurrently.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle({ client: sqlite, schema, casing: 'snake_case' });
  migrate(db, { migrationsFolder: migrationsDir });
  return db;
}

const globalForDb = globalThis as typeof globalThis & { __jobTrackerDb?: AppDatabase };

/** Process-wide connection. Cached on `globalThis` so Next.js hot reloads don't leak handles. */
export function getDatabase(): AppDatabase {
  if (!globalForDb.__jobTrackerDb) {
    const { databaseFile, migrationsDir } = getConfig();
    globalForDb.__jobTrackerDb = openDatabase({ file: databaseFile, migrationsDir });
  }
  return globalForDb.__jobTrackerDb;
}
