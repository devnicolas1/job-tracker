import type { JobStatus } from '@/core/jobs/schemas';
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
