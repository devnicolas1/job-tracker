import { cn } from '@/lib/cn';

import { scoreTone } from '../presentation';

const ring = {
  success: 'text-success bg-success-soft',
  accent: 'text-accent bg-accent-soft',
  warning: 'text-warning bg-warning-soft',
  danger: 'text-danger bg-danger-soft',
  neutral: 'text-muted bg-surface-muted',
} as const;

/** The agent's 0–100 fit score, colour-coded. */
export function ScoreBadge({
  score,
  size = 'md',
}: {
  score: number | undefined;
  size?: 'md' | 'lg';
}) {
  const tone = score === undefined ? 'neutral' : scoreTone(score);
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-xl font-semibold tabular-nums',
        ring[tone],
        size === 'lg' ? 'size-16 text-2xl' : 'size-11 text-base',
      )}
      title={score === undefined ? 'Not assessed' : `Fit score: ${score}/100`}
    >
      {score ?? '–'}
      <span className="sr-only">out of 100 fit score</span>
    </div>
  );
}
