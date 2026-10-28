import type { JobDetails, JobListing } from '@/core/sources/types';

const MAX_ENTRIES = 1_000;

/**
 * Remembers listings and details fetched during the session, so `save_job` and `dismiss_jobs` can
 * be called with just `source` + `externalId`. The agent never has to echo a posting back, which
 * would double its token cost.
 */
export function createJobCache() {
  const entries = new Map<string, JobListing | JobDetails>();
  const key = (source: string, externalId: string) => `${source}:${externalId}`;

  return {
    remember(source: string, item: JobListing | JobDetails): void {
      const id = key(source, item.externalId);
      // Merge: details lack the posting date that listings carry, and vice versa.
      const merged = { ...entries.get(id), ...stripUndefined(item) } as JobListing | JobDetails;
      entries.delete(id);
      entries.set(id, merged);
      // Maps iterate in insertion order, so the first key is the least recently remembered.
      const oldest = entries.keys().next();
      if (entries.size > MAX_ENTRIES && !oldest.done) entries.delete(oldest.value);
    },

    get(source: string, externalId: string): (JobListing & Partial<JobDetails>) | undefined {
      return entries.get(key(source, externalId));
    },
  };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export type JobCache = ReturnType<typeof createJobCache>;
