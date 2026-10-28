import type { TextRun } from './model';

/*
 * The agent reads and writes paragraph text with a minimal markup: `**bold**`, `*italic*` and
 * `***bold italic***`. Everything else about a run's look (font, size, colour) is inherited from
 * the paragraph, so the agent can change words but not design.
 */

export interface MarkupSegment {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
}

const TOKEN = /(\*{1,3})([^*]+?)\1(?!\*)/g;

export function parseMarkup(value: string): MarkupSegment[] {
  const segments: MarkupSegment[] = [];
  let cursor = 0;
  for (const match of value.matchAll(TOKEN)) {
    const [whole, stars = '', text = ''] = match;
    if (match.index > cursor) {
      segments.push({ text: value.slice(cursor, match.index), bold: false, italic: false });
    }
    segments.push({ text, bold: stars.length !== 1, italic: stars.length !== 2 });
    cursor = match.index + whole.length;
  }
  if (cursor < value.length)
    segments.push({ text: value.slice(cursor), bold: false, italic: false });
  return segments.filter((segment) => segment.text.length > 0);
}

export function toMarkup(runs: readonly Pick<TextRun, 'text' | 'font'>[]): string {
  // Merge neighbours with the same emphasis first, so "**Foo** **bar**" reads "**Foo bar**".
  const merged: { text: string; bold: boolean; italic: boolean }[] = [];
  for (const { text, font } of runs) {
    const last = merged.at(-1);
    if (last?.bold === font.bold && last.italic === font.italic) last.text += text;
    else merged.push({ text, bold: font.bold, italic: font.italic });
  }

  return merged
    .map(({ text, bold, italic }) => {
      const stars = bold && italic ? '***' : bold ? '**' : italic ? '*' : '';
      if (!stars || !text.trim()) return text;
      // Keep surrounding spaces outside the markers: "**Lead:** text", not "**Lead: **text".
      const [, before = '', core = '', after = ''] = /^(\s*)(.*?)(\s*)$/s.exec(text) ?? [];
      return `${before}${stars}${core}${stars}${after}`;
    })
    .join('');
}
