import { Search, Sparkles } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { getServices } from '@/core/container';
import { jobStatusSchema, type JobStatus, type JobSummary } from '@/core/jobs/schemas';
import { JobCard } from '@/features/jobs/components/job-card';
import { groupByDayAdded, STATUS_META, STATUS_TABS } from '@/features/jobs/presentation';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { Input, Select } from '@/ui/field';
import { PageHeader } from '@/ui/page-header';

export const metadata: Metadata = { title: 'Jobs' };

const MIN_SCORES = [50, 65, 80] as const;

interface Filters {
  readonly status?: JobStatus;
  readonly query?: string;
  readonly minScore?: number;
  /** Absent: grouped by the day each job was added, newest first. */
  readonly sort?: 'score';
}

/** Search params are user input: anything unrecognised is ignored rather than rejected. */
function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const single = (key: string) => (typeof params[key] === 'string' ? params[key] : undefined);
  const status = jobStatusSchema.safeParse(single('status'));
  const minScore = Number(single('min'));
  return {
    status: status.success ? status.data : undefined,
    query: single('q')?.trim() || undefined,
    minScore: (MIN_SCORES as readonly number[]).includes(minScore) ? minScore : undefined,
    sort: single('sort') === 'score' ? 'score' : undefined,
  };
}

function hrefFor(filters: Filters): Route {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.query) params.set('q', filters.query);
  if (filters.minScore) params.set('min', String(filters.minScore));
  if (filters.sort) params.set('sort', filters.sort);
  const query = params.toString();
  return query ? `/jobs?${query}` : '/jobs';
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const { jobs } = getServices();
  const counts = jobs.countByStatus();
  const results = jobs.list({
    statuses: filters.status ? [filters.status] : undefined,
    query: filters.query,
    minScore: filters.minScore,
    sort: filters.sort ?? 'newest',
  });
  const activeTotal = STATUS_TABS.filter((status) => status !== 'dismissed').reduce(
    (sum, status) => sum + counts[status],
    0,
  );

  const tabs = [
    {
      key: 'all',
      label: 'All',
      count: activeTotal,
      href: hrefFor({ ...filters, status: undefined }),
      active: !filters.status,
    },
    ...STATUS_TABS.map((status) => ({
      key: status,
      label: STATUS_META[status].label,
      count: counts[status],
      href: hrefFor({ ...filters, status }),
      active: filters.status === status,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Opportunities found and assessed by your agent, grouped by the day they were added."
      />

      <div className="mb-5 flex flex-col gap-3">
        <nav
          aria-label="Filter by status"
          className="-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto px-1 pb-1"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab.active
                  ? 'bg-text text-canvas'
                  : 'text-muted hover:bg-surface-muted hover:text-text',
              )}
            >
              {tab.label}
              <span
                className={cn('text-xs tabular-nums', tab.active ? 'opacity-70' : 'text-subtle')}
              >
                {tab.count}
              </span>
            </Link>
          ))}
        </nav>

        {/* Plain GET form: filters live in the URL, so views are shareable and work without JS. */}
        <form action="/jobs" className="flex flex-wrap gap-2" role="search">
          {filters.status && <input type="hidden" name="status" value={filters.status} />}
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
              aria-hidden
            />
            <Input
              name="q"
              type="search"
              defaultValue={filters.query}
              placeholder="Search title or company"
              aria-label="Search jobs"
              className="w-full pl-9"
            />
          </div>
          <Select
            name="min"
            defaultValue={filters.minScore ?? ''}
            aria-label="Minimum fit score"
            className="w-auto"
          >
            <option value="">Any score</option>
            {MIN_SCORES.map((score) => (
              <option key={score} value={score}>
                {score}+ fit
              </option>
            ))}
          </Select>
          <Select
            name="sort"
            defaultValue={filters.sort ?? ''}
            aria-label="Order"
            className="w-auto"
          >
            <option value="">Newest first</option>
            <option value="score">Best match</option>
          </Select>
          <Button type="submit">Apply</Button>
        </form>
      </div>

      {results.length > 0 && filters.sort === 'score' ? (
        <JobList jobs={results} />
      ) : results.length > 0 ? (
        <div className="flex flex-col gap-8">
          {groupByDayAdded(results).map((group) => (
            <section key={group.key} aria-labelledby={`added-${group.key}`}>
              <h2
                id={`added-${group.key}`}
                className="mb-3 flex items-baseline gap-2 text-sm font-semibold"
              >
                {group.label}
                <span className="text-xs font-normal text-subtle tabular-nums">
                  {group.jobs.length} added
                </span>
              </h2>
              <JobList jobs={group.jobs} />
            </section>
          ))}
        </div>
      ) : activeTotal + counts.dismissed === 0 ? (
        <EmptyState icon={Sparkles} title="No jobs yet">
          Fill in your profile and preferences, then open Claude Code or Codex in this project and
          run{' '}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
            /find-jobs
          </code>{' '}
          (in Codex, ask it to find jobs). Matches appear here with a fit score and a tailored
          résumé.
        </EmptyState>
      ) : (
        <EmptyState icon={Search} title="No jobs match these filters" />
      )}
    </>
  );
}

function JobList({ jobs }: { jobs: readonly JobSummary[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {jobs.map((job) => (
        <li key={job.id}>
          <JobCard job={job} />
        </li>
      ))}
    </ul>
  );
}
