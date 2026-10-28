import * as cheerio from 'cheerio';

import type { ResumeLanguage } from './schemas';

/**
 * Converts an HTML fragment to compact plain text, keeping paragraph and list structure. Plain text
 * is ~3× cheaper than HTML for a language model to read.
 */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p(\s[^>]*)?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|ul|ol|h[1-6]|section)>/gi, '\n');

  return cheerio
    .load(withBreaks)
    .text()
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Collapses runs of whitespace (including newlines) into single spaces. */
export const squish = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** Truncates on a word boundary and marks the cut, so a reader knows text is missing. */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  // Look one character past the limit so a cut that lands right before a space counts as clean.
  const boundary = value.slice(0, maxLength + 1).lastIndexOf(' ');
  const end = boundary >= maxLength * 0.8 ? boundary : maxLength;
  return `${value.slice(0, end).trimEnd()} […]`;
}

const STOPWORDS: Readonly<Record<ResumeLanguage, ReadonlySet<string>>> = {
  en: new Set(['the', 'and', 'with', 'you', 'our', 'for', 'will', 'are', 'of', 'to', 'experience']),
  pt: new Set(['de', 'e', 'com', 'você', 'para', 'em', 'que', 'uma', 'os', 'nossa', 'experiência']),
};

/**
 * Cheap stop-word vote between the languages we write résumés in. Good enough to pick the résumé
 * language for a posting; returns `undefined` when the text gives no clear signal.
 */
export function detectLanguage(text: string): ResumeLanguage | undefined {
  const words =
    text
      .toLowerCase()
      .match(/\p{L}+/gu)
      ?.slice(0, 400) ?? [];
  const score = (language: ResumeLanguage) =>
    words.filter((word) => STOPWORDS[language].has(word)).length;

  const en = score('en');
  const pt = score('pt');
  if (Math.max(en, pt) < 5) return undefined;
  return pt > en ? 'pt' : 'en';
}
