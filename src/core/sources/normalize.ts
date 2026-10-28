import type { EmploymentType, WorkplaceType } from '@/core/shared/schemas';

/*
 * Every board spells the same facts differently ("FULL_TIME", "full-time", "Full time"…). These
 * map them onto the tracker's vocabulary; anything unrecognised becomes `undefined`.
 */

export function employmentTypeFrom(value: string | null | undefined): EmploymentType | undefined {
  const text = value?.toLowerCase().replace(/[\s_]+/g, '-') ?? '';
  if (text.includes('full')) return 'full-time';
  if (text.includes('part')) return 'part-time';
  if (text.includes('contract')) return 'contract';
  if (text.includes('freelance')) return 'freelance';
  if (text.includes('intern')) return 'internship';
  if (text.includes('temp')) return 'temporary';
  return undefined;
}

export function workplaceTypeFrom(value: string | null | undefined): WorkplaceType | undefined {
  const text = value?.toLowerCase() ?? '';
  if (/hybrid|híbrido/.test(text)) return 'hybrid';
  if (/remote|remoto|anywhere|worldwide/.test(text)) return 'remote';
  if (/on-?site|presencial|in-office|office/.test(text)) return 'onsite';
  return undefined;
}

/** Any parseable date → `YYYY-MM-DD`, or `undefined`. Unix seconds are accepted as numbers. */
export function isoDate(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

/** Joins the parts that are present: "a · b". */
export const summarize = (...parts: (string | null | undefined)[]) =>
  parts.filter((part) => part?.trim()).join(' · ');
