'use client';

import { useOptimistic, useTransition } from 'react';

import { JOB_STATUSES, type JobStatus } from '@/core/jobs/schemas';
import { cn } from '@/lib/cn';

import { updateJobStatusAction } from '../actions';
import { STATUS_META } from '../presentation';

const tones = {
  accent: 'bg-accent-soft text-accent',
  neutral: 'bg-surface-muted text-muted',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
} as const;

/** Status pill that doubles as a select; updates optimistically. */
export function StatusSelect({ jobId, status }: { jobId: string; status: JobStatus }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Application status"
      value={optimistic}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as JobStatus;
        startTransition(async () => {
          setOptimistic(next);
          await updateJobStatusAction(jobId, next);
        });
      }}
      className={cn(
        'h-7 cursor-pointer appearance-none rounded-md border-0 px-2.5 text-xs font-semibold transition-colors',
        tones[STATUS_META[optimistic].tone],
      )}
    >
      {JOB_STATUSES.map((value) => (
        <option key={value} value={value}>
          {STATUS_META[value].label}
        </option>
      ))}
    </select>
  );
}
