const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 days ago", "yesterday", "just now". */
export function formatRelative(date: Date | string, now = new Date()): string {
  const seconds = (new Date(date).getTime() - now.getTime()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size)
      return relativeFormatter.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

const monthFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `2024-03` → "Mar 2024". */
export const formatYearMonth = (value: string) =>
  monthFormatter.format(new Date(`${value}-01T00:00:00Z`));

export function formatPeriod(start?: string, end?: string, ongoing = false): string | undefined {
  const from = start && formatYearMonth(start);
  const to = end ? formatYearMonth(end) : ongoing ? 'Present' : undefined;
  if (from && to) return `${from} – ${to}`;
  return from ?? to;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** `full-time` → "Full-time", `mid-senior` → "Mid-senior". */
export const humanize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

/** Local calendar day, `2026-10-28`: a stable key for grouping by day. */
export function dayKey(date: Date | string): string {
  const day = new Date(date);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(day.getFullYear())}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

const weekdayFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});
const fullDayFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** "Today", "Yesterday", "Monday, Oct 26", or with the year when it isn't this year. */
export function formatDay(date: Date | string, now = new Date()): string {
  const day = new Date(date);
  if (dayKey(day) === dayKey(now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(day) === dayKey(yesterday)) return 'Yesterday';
  return (day.getFullYear() === now.getFullYear() ? weekdayFormatter : fullDayFormatter).format(
    day,
  );
}
