import { and, desc, eq, gte, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';

import type { AppDatabase } from '@/core/db/client';
import { jobs, type JobRow } from '@/core/db/schema';
import { NotFoundError } from '@/core/shared/errors';
import { createId } from '@/core/shared/ids';
import { parseInput } from '@/core/shared/validation';
import type { ResumeTailoring } from '@/core/tailoring/schemas';
import type { TailoredResumeService } from '@/core/tailoring/service';

import {
  jobFilterSchema,
  jobStatusSchema,
  saveJobSchema,
  type Job,
  type JobFilter,
  type JobPosting,
  type JobStatus,
  type JobSummary,
} from './schemas';

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    source: row.source,
    externalId: row.externalId,
    url: row.url,
    title: row.title,
    company: row.company,
    location: row.location ?? undefined,
    workplaceType: row.workplaceType ?? undefined,
    employmentType: row.employmentType ?? undefined,
    seniority: row.seniority ?? undefined,
    salary: row.salary ?? undefined,
    postedAt: row.postedAt ?? undefined,
    language: row.language ?? undefined,
    description: row.description ?? undefined,
    status: row.status,
    notes: row.notes,
    assessment: row.assessment,
    tailoredResume: row.tailoredResume,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    statusChangedAt: row.statusChangedAt,
  };
}

/** Columns for list views: everything except the heavy text/JSON payloads. */
const summaryColumns = {
  id: jobs.id,
  source: jobs.source,
  externalId: jobs.externalId,
  url: jobs.url,
  title: jobs.title,
  company: jobs.company,
  location: jobs.location,
  workplaceType: jobs.workplaceType,
  employmentType: jobs.employmentType,
  seniority: jobs.seniority,
  salary: jobs.salary,
  postedAt: jobs.postedAt,
  language: jobs.language,
  status: jobs.status,
  notes: jobs.notes,
  assessment: jobs.assessment,
  createdAt: jobs.createdAt,
  updatedAt: jobs.updatedAt,
  statusChangedAt: jobs.statusChangedAt,
  hasTailoredResume: sql<number>`${jobs.tailoredResume} is not null`.mapWith(Boolean),
};

export interface DismissedPosting extends Pick<
  JobPosting,
  'source' | 'externalId' | 'url' | 'title' | 'company'
> {
  readonly reason?: string;
}

export function createJobService(
  db: AppDatabase,
  deps: { tailoring: Pick<TailoredResumeService, 'prepare'> },
) {
  function findRow(id: string): JobRow {
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get();
    if (!row) throw new NotFoundError('Job', id);
    return row;
  }

  /**
   * Inserts a posting, or refreshes it if `(source, externalId)` is already tracked. The user's
   * status and notes are preserved on refresh unless a status is passed explicitly.
   */
  function upsert(
    { assessment, tailoredResume: _input, status, ...posting }: z.output<typeof saveJobSchema>,
    tailoredResume?: ResumeTailoring,
  ): { job: Job; created: boolean } {
    const existing = db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.source, posting.source), eq(jobs.externalId, posting.externalId)))
      .get();

    const values = {
      ...posting,
      ...(assessment && { assessment, matchScore: assessment.matchScore }),
      ...(tailoredResume && { tailoredResume }),
      ...(status && { status, statusChangedAt: new Date() }),
    };

    const row = db
      .insert(jobs)
      .values({ id: createId(), ...values })
      .onConflictDoUpdate({ target: [jobs.source, jobs.externalId], set: values })
      .returning()
      .get();
    return { job: toJob(row), created: !existing };
  }

  return {
    list(filter: JobFilter = {}): JobSummary[] {
      const { statuses, minScore, query, sort, limit } = parseInput(jobFilterSchema, filter);
      const conditions: (SQL | undefined)[] = [
        // Dismissed postings are bookkeeping for the agent; hide them unless asked for.
        statuses?.length ? inArray(jobs.status, statuses) : ne(jobs.status, 'dismissed'),
        minScore === undefined ? undefined : gte(jobs.matchScore, minScore),
      ];
      if (query) {
        const needle = query.toLowerCase();
        conditions.push(
          or(
            sql`instr(lower(${jobs.title}), ${needle}) > 0`,
            sql`instr(lower(${jobs.company}), ${needle}) > 0`,
          ),
        );
      }

      return db
        .select(summaryColumns)
        .from(jobs)
        .where(and(...conditions))
        .orderBy(
          ...(sort === 'newest'
            ? // rowid breaks ties between jobs saved in the same millisecond.
              [desc(jobs.createdAt), sql`rowid desc`]
            : [sql`${jobs.matchScore} is null`, desc(jobs.matchScore), desc(jobs.createdAt)]),
        )
        .limit(limit ?? 200)
        .all()
        .map((row) => ({
          ...row,
          location: row.location ?? undefined,
          workplaceType: row.workplaceType ?? undefined,
          employmentType: row.employmentType ?? undefined,
          seniority: row.seniority ?? undefined,
          salary: row.salary ?? undefined,
          postedAt: row.postedAt ?? undefined,
          language: row.language ?? undefined,
        }));
    },

    get(id: string): Job {
      return toJob(findRow(id));
    },

    countByStatus(): Record<JobStatus, number> {
      const rows = db
        .select({ status: jobs.status, count: sql<number>`count(*)` })
        .from(jobs)
        .groupBy(jobs.status)
        .all();
      const counts = Object.fromEntries(jobStatusSchema.options.map((status) => [status, 0]));
      for (const row of rows) counts[row.status] = row.count;
      return counts as Record<JobStatus, number>;
    },

    /** Of the given source ids, returns those already tracked (in any status, dismissed included). */
    findKnownExternalIds(source: string, externalIds: readonly string[]): Set<string> {
      if (externalIds.length === 0) return new Set();
      const rows = db
        .select({ externalId: jobs.externalId })
        .from(jobs)
        .where(and(eq(jobs.source, source), inArray(jobs.externalId, [...externalIds])))
        .all();
      return new Set(rows.map((row) => row.externalId));
    },

    async save(input: unknown): Promise<{ job: Job; created: boolean }> {
      const parsed = parseInput(saveJobSchema, input);
      const tailoring =
        parsed.tailoredResume && (await deps.tailoring.prepare(parsed.tailoredResume));
      return upsert(parsed, tailoring);
    },

    /** Records postings the agent rejected, so they are skipped by future searches. */
    dismiss(postings: readonly DismissedPosting[]): number {
      return db.transaction(() =>
        postings.reduce((count, { reason, ...posting }) => {
          const { job } = upsert(parseInput(saveJobSchema, { ...posting, status: 'dismissed' }));
          if (reason) {
            db.update(jobs)
              .set({ notes: `Dismissed by agent: ${reason}` })
              .where(eq(jobs.id, job.id))
              .run();
          }
          return count + 1;
        }, 0),
      );
    },

    updateStatus(id: string, status: JobStatus): Job {
      parseInput(jobStatusSchema, status);
      findRow(id);
      const row = db
        .update(jobs)
        .set({ status, statusChangedAt: new Date() })
        .where(eq(jobs.id, id))
        .returning()
        .get();
      return toJob(row);
    },

    /** Attaches or replaces a tailored résumé, validated against the current base résumé. */
    async setTailoredResume(id: string, input: unknown): Promise<Job> {
      findRow(id);
      const tailoredResume = await deps.tailoring.prepare(input);
      const row = db.update(jobs).set({ tailoredResume }).where(eq(jobs.id, id)).returning().get();
      return toJob(row);
    },

    updateNotes(id: string, notes: string): Job {
      findRow(id);
      const trimmed = notes.trim().slice(0, 10_000);
      const row = db
        .update(jobs)
        .set({ notes: trimmed || null })
        .where(eq(jobs.id, id))
        .returning()
        .get();
      return toJob(row);
    },

    remove(id: string): void {
      const { changes } = db.delete(jobs).where(eq(jobs.id, id)).run();
      if (changes === 0) throw new NotFoundError('Job', id);
    },
  };
}

export type JobService = ReturnType<typeof createJobService>;
