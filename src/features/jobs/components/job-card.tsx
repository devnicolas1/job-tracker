import { Building2, FileText, MapPin } from 'lucide-react';
import Link from 'next/link';

import type { JobSummary } from '@/core/jobs/schemas';
import { formatRelative, humanize } from '@/lib/format';
import { Badge } from '@/ui/badge';

import { ScoreBadge } from './score-badge';
import { StatusSelect } from './status-select';

export function JobCard({ job }: { job: JobSummary }) {
  return (
    <article className="relative flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs transition-colors hover:border-border-strong">
      <ScoreBadge score={job.assessment?.matchScore} />

      <div className="min-w-0 flex-1">
        <h2 className="leading-snug font-semibold">
          {/* Stretched link: the whole card is clickable, inner controls stay interactive. */}
          <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0 after:rounded-xl">
            {job.title}
          </Link>
        </h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted">
          <span className="flex items-center gap-1">
            <Building2 className="size-3.5" aria-hidden />
            {job.company}
          </span>
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {job.location}
            </span>
          )}
        </p>
        {job.assessment && (
          <p className="mt-2 line-clamp-2 text-muted">{job.assessment.matchSummary}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {job.workplaceType && <Badge>{humanize(job.workplaceType)}</Badge>}
          {job.seniority && <Badge>{job.seniority}</Badge>}
          {job.salary && <Badge tone="success">{job.salary}</Badge>}
          {job.hasTailoredResume && (
            <Badge tone="accent">
              <FileText aria-hidden /> Tailored résumé
            </Badge>
          )}
          <span className="ml-auto text-xs text-subtle">
            {job.postedAt
              ? `Posted ${formatRelative(job.postedAt)}`
              : `Found ${formatRelative(job.createdAt)}`}
          </span>
        </div>
      </div>

      <div className="relative z-10 shrink-0 self-start">
        <StatusSelect jobId={job.id} status={job.status} />
      </div>
    </article>
  );
}
