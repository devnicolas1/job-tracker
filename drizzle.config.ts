import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/core/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: './data/job-tracker.db' },
});
