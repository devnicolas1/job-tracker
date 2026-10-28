import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { JobAssessment, JobStatus } from '@/core/jobs/schemas';
import type { JobPreferences, ProfileBasics, ProfileSection } from '@/core/profile/schemas';
import type { EmploymentType, ResumeLanguage, WorkplaceType } from '@/core/shared/schemas';
import type { ResumeTailoring } from '@/core/tailoring/schemas';

/*
 * Storage notes
 * - JSON columns hold values that are always read and written as a whole and never queried by
 *   their inner fields. They are validated with zod at the service boundary, so the database
 *   stays a dumb, trusted store.
 * - Timestamps are epoch milliseconds; Drizzle maps them to `Date`.
 */

const timestamps = {
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`)
    .$onUpdateFn(() => new Date()),
};

/** Single-row table (id = 1) holding the profile's singleton documents. */
export const profile = sqliteTable('profile', {
  id: integer().primaryKey(),
  basics: text({ mode: 'json' }).$type<ProfileBasics>(),
  preferences: text({ mode: 'json' }).$type<JobPreferences>(),
  ...timestamps,
});

/** Repeatable profile sections (experience, education, …), one row per entry. */
export const profileEntries = sqliteTable(
  'profile_entries',
  {
    id: text().primaryKey(),
    section: text().$type<ProfileSection>().notNull(),
    position: integer().notNull(),
    data: text({ mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    ...timestamps,
  },
  (table) => [index('profile_entries_section_position_idx').on(table.section, table.position)],
);

/** The user's own base résumés, at most one per language. Files live on disk. */
export const resumes = sqliteTable('resumes', {
  language: text().$type<ResumeLanguage>().primaryKey(),
  fileName: text().notNull(),
  storedName: text().notNull(),
  mimeType: text().notNull(),
  sizeBytes: integer().notNull(),
  ...timestamps,
});

export const jobs = sqliteTable(
  'jobs',
  {
    id: text().primaryKey(),
    source: text().notNull(),
    externalId: text().notNull(),
    url: text().notNull(),
    title: text().notNull(),
    company: text().notNull(),
    location: text(),
    workplaceType: text().$type<WorkplaceType>(),
    employmentType: text().$type<EmploymentType>(),
    seniority: text(),
    salary: text(),
    postedAt: text(),
    language: text().$type<ResumeLanguage>(),
    description: text(),
    status: text().$type<JobStatus>().notNull().default('new'),
    statusChangedAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
    notes: text(),
    matchScore: integer(),
    assessment: text({ mode: 'json' }).$type<JobAssessment>(),
    tailoredResume: text({ mode: 'json' }).$type<ResumeTailoring>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('jobs_source_external_id_idx').on(table.source, table.externalId),
    index('jobs_status_score_idx').on(table.status, table.matchScore),
  ],
);

export type JobRow = typeof jobs.$inferSelect;
export type ProfileEntryRow = typeof profileEntries.$inferSelect;
export type ResumeRow = typeof resumes.$inferSelect;
