import path from 'node:path';

export interface AppConfig {
  /** Root of the repository; migrations are resolved from here. */
  readonly rootDir: string;
  /** Where personal data (SQLite database, uploaded resumes) lives. Git-ignored. */
  readonly dataDir: string;
  readonly databaseFile: string;
  readonly resumesDir: string;
  readonly migrationsDir: string;
  /** Base URL of the web app, used to hand the agent clickable links. */
  readonly webUrl: string;
}

let cached: AppConfig | undefined;

/**
 * Resolved lazily so that entry points (Next.js, the MCP server, tests) can adjust the
 * environment before anything touches the filesystem.
 */
export function getConfig(): AppConfig {
  if (cached) return cached;

  // Runtime-only paths: tell Next's file tracer not to bundle the whole project because of them.
  const rootDir = path.resolve(
    /*turbopackIgnore: true*/ process.env.JOB_TRACKER_ROOT ?? process.cwd(),
  );
  const dataDir = path.resolve(rootDir, process.env.JOB_TRACKER_DATA_DIR ?? 'data');

  cached = Object.freeze({
    rootDir,
    dataDir,
    databaseFile: path.join(dataDir, 'job-tracker.db'),
    resumesDir: path.join(dataDir, 'resumes'),
    migrationsDir: path.join(rootDir, 'drizzle'),
    webUrl: (process.env.JOB_TRACKER_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  });
  return cached;
}
