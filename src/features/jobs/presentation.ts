import type { JobStatus, JobSummary } from '@/core/jobs/schemas';
import { dayKey, formatDay } from '@/lib/format';
import type { Tone } from '@/ui/badge';

export const STATUS_META: Readonly<Record<JobStatus, { label: string; tone: Tone }>> = {
  new: { label: 'New', tone: 'accent' },
  saved: { label: 'Saved', tone: 'neutral' },
  applied: { label: 'Applied', tone: 'warning' },
  interviewing: { label: 'Interviewing', tone: 'warning' },
  offer: { label: 'Offer', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
};

/** Tabs on the jobs page: the active pipeline first, closed outcomes after. */
export const STATUS_TABS: readonly JobStatus[] = [
  'new',
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'dismissed',
];

export function scoreTone(score: number): Tone {
  if (score >= 80) return 'success';
  if (score >= 65) return 'accent';
  if (score >= 50) return 'warning';
  return 'danger';
}

export interface JobDayGroup<T> {
  readonly key: string;
  readonly label: string;
  readonly jobs: readonly T[];
}

/**
 * Splits jobs by the local day they were added, newest day first; within a day, best match
 * first. Expects `jobs` newest first, as `list({ sort: 'newest' })` returns them.
 */
export function groupByDayAdded<T extends Pick<JobSummary, 'createdAt' | 'assessment'>>(
  jobs: readonly T[],
  now = new Date(),
): JobDayGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const job of jobs) {
    const key = dayKey(job.createdAt);
    const group = groups.get(key);
    if (group) group.push(job);
    else groups.set(key, [job]);
  }
  const score = (job: T) => job.assessment?.matchScore ?? -1;
  return [...groups].map(([key, members]) => ({
    key,
    label: formatDay(members[0]?.createdAt ?? key, now),
    jobs: members.toSorted((a, b) => score(b) - score(a)),
  }));
}
