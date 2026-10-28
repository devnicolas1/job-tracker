import {
  sameStyle,
  type Alignment,
  type Paragraph,
  type ResumeLayout,
  type Rule,
  type TextRun,
  type TextStyle,
} from './model';
import type { RawChar, RawLine, RawPage } from './read-pdf';

/*
 * Turns raw PDF lines into paragraphs. PDFs have no notion of paragraphs, so they are inferred
 * from geometry, the same cues a reader uses: bullet markers, indentation, vertical gaps, changes
 * of size or colour, and lines that end early (a hard break rather than a wrap).
 * Pure functions over plain data: unit-tested without any PDF.
 */

const BULLETS = new Set(['•', '●', '◦', '○', '▪', '■', '‣', '►', '➢', '✓', '–', '-', '*', '·']);
const INVISIBLE = /[​-‍⁠﻿]/;
/** A gap wider than this many font sizes inside a line is a tab (e.g. a right-aligned date). */
const TAB_GAP = 2.5;
export const TAB = '\t';

/** A list known to have at least one element: first and last always exist. */
type NonEmpty<T> = readonly [T, ...T[]];
const lastOf = <T>(items: NonEmpty<T>): T => items[items.length - 1] as T;

interface Line {
  readonly page: number;
  readonly chars: readonly RawChar[];
  readonly marker?: Paragraph['marker'];
  readonly left: number;
  readonly right: number;
  readonly baseline: number;
  readonly size: number;
  readonly color: string;
  readonly firstWordWidth: number;
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/** The style used by most characters. */
function dominant(chars: NonEmpty<RawChar>): TextStyle {
  const counts = new Map<RawChar['style'], number>();
  for (const { char, style } of chars) {
    if (char.trim()) counts.set(style, (counts.get(style) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? chars[0].style;
}

/** Cleans a raw line and measures it; `null` for lines with no visible text. */
function toLine(page: number, raw: RawLine): Line | null {
  let chars = raw.chars.filter(({ char }) => !INVISIBLE.test(char));
  const firstVisible = chars.findIndex(({ char }) => char.trim() !== '');
  if (firstVisible === -1) return null;
  chars = chars.slice(firstVisible);
  while (chars.at(-1)?.char.trim() === '') chars = chars.slice(0, -1);

  let marker: Line['marker'];
  const [first] = chars;
  const next = chars.slice(1).find(({ char }) => char.trim() !== '');
  if (first && next && BULLETS.has(first.char) && next.x - first.right >= 2) {
    marker = { text: first.char, x: first.x, style: first.style };
    chars = chars.slice(chars.indexOf(next));
  }

  // Wide gaps between glyphs are tabs: keep them as a single tab character.
  const withTabs: RawChar[] = [];
  for (const char of chars) {
    const previous = withTabs.at(-1);
    const gap = previous ? char.x - previous.right : 0;
    if (previous && char.char.trim() && gap > TAB_GAP * char.style.size) {
      while (withTabs.at(-1)?.char === ' ') withTabs.pop();
      withTabs.push({ ...previous, char: TAB, x: previous.right, right: char.x });
    }
    if (!(withTabs.at(-1)?.char === TAB && char.char === ' ')) withTabs.push(char);
  }

  const [start, ...rest] = withTabs;
  if (!start) return null;
  const visible = withTabs.filter(({ char }) => char.trim() !== '');
  const firstSpace = withTabs.findIndex(({ char }) => char === ' ');
  const firstWordEnd = firstSpace === -1 ? withTabs.at(-1) : withTabs[firstSpace - 1];
  const style = dominant([start, ...rest]);

  return {
    page,
    chars: withTabs,
    marker,
    left: start.x,
    right: Math.max(...visible.map((char) => char.right)),
    baseline: median(visible.map((char) => char.y)),
    size: style.size,
    color: style.color,
    firstWordWidth: (firstWordEnd?.right ?? start.x) - start.x,
  };
}

interface Content {
  readonly left: number;
  readonly right: number;
  /** Usual baseline distance between lines of one paragraph, by font size. */
  readonly pitch: ReadonlyMap<number, number>;
}

/**
 * Line spacing inside paragraphs, learned per font size: the most frequent gap between
 * consecutive lines of that size. Paragraph spacing is larger, and rarer.
 */
function typicalPitches(lines: readonly Line[]): Map<number, number> {
  const counts = new Map<number, Map<number, number>>();
  lines.forEach((line, index) => {
    const previous = lines[index - 1];
    if (previous?.page !== line.page || previous.size !== line.size) return;
    const gap = Math.round((line.baseline - previous.baseline) * 10) / 10;
    if (gap < line.size * 0.9 || gap > line.size * 2) return;
    const tally = counts.get(line.size) ?? new Map<number, number>();
    tally.set(gap, (tally.get(gap) ?? 0) + 1);
    counts.set(line.size, tally);
  });
  const pitches = new Map<number, number>();
  for (const [size, tally] of counts) {
    const [mostFrequent] = [...tally].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    if (mostFrequent) pitches.set(size, mostFrequent[0]);
  }
  return pitches;
}

const center = (content: Content) => (content.left + content.right) / 2;
/** Bulleted lines are never centred; a long indented line can sit near the centre by chance. */
const isCentered = (line: Line, content: Content) =>
  !line.marker &&
  Math.abs((line.left + line.right) / 2 - center(content)) < 1.5 &&
  line.left > content.left + 4;

/** Whether `line` starts a new paragraph after the lines collected so far. */
function startsParagraph(lines: NonEmpty<Line>, line: Line, content: Content): boolean {
  const [first] = lines;
  const last = lastOf(lines);
  const beforeLast = lines[lines.length - 2];
  if (line.marker) return true;
  // MuPDF's text blocks are not used: they split on rendering details, not on paragraphs.
  if (line.page !== last.page) return true;
  if (Math.abs(line.size - last.size) > 0.25 || line.color !== last.color) return true;
  if (last.chars.some(({ char }) => char === TAB)) return true;

  const pitch = beforeLast
    ? last.baseline - beforeLast.baseline
    : (content.pitch.get(last.size) ?? last.size * 1.22);
  const gap = line.baseline - last.baseline;
  if (gap <= 0 || gap > pitch + Math.max(1, pitch * 0.08)) return true;

  const centered = isCentered(first, content) && isCentered(line, content);
  // Continuation lines align with the first line's text (a marker hangs outside it).
  if (!centered && Math.abs(line.left - first.left) > 2) return true;

  // If the previous line had room for this line's first word, it ended on purpose: a hard break.
  const available = centered ? content.right - content.left : content.right - first.left;
  const used = last.right - last.left + 0.25 * last.size + line.firstWordWidth;
  return used < available - 1;
}

function toRuns(lines: readonly Line[]): TextRun[] {
  const runs: { text: string; style: TextStyle }[] = [];
  const push = (text: string, style: TextStyle) => {
    const last = runs.at(-1);
    if (last && sameStyle(last.style, style)) last.text += text;
    else runs.push({ text, style });
  };

  for (const line of lines) {
    const previous = runs.at(-1);
    // Lines join with a space, except words broken at a hyphen ("multi-" / "company").
    if (previous && !/\p{L}-$/u.test(previous.text)) push(' ', previous.style);
    for (const { char, style } of line.chars) push(char, style);
  }

  return runs.map(({ text, style }) => ({ ...style, text }));
}

function alignmentOf(lines: readonly Line[], content: Content): Alignment {
  if (lines.every((line) => isCentered(line, content))) return 'center';
  const body = lines.slice(0, -1);
  if (body.length > 0 && body.every((line) => line.right >= content.right - 2)) return 'justify';
  if (lines.every((line) => line.right >= content.right - 1.5 && line.left > content.left + 4)) {
    return 'right';
  }
  return 'left';
}

type Draft = Omit<Paragraph, 'id' | 'spaceBefore' | 'rules' | 'lineHeight'> & {
  page: number;
  firstBaseline: number;
  lastBaseline: number;
  size: number;
  pitch: number | null;
  hasMarker: boolean;
  /** Alignment is only evident from 3+ lines; shorter paragraphs may fill a line by chance. */
  confident: boolean;
};

/** Paragraphs that look alike: same size, weight and marker. */
const signature = (draft: Draft) =>
  `${draft.size}|${draft.hasMarker}|${draft.runs[0]?.font.bold ?? false}`;

/** Short paragraphs take the alignment most of their confidently aligned look-alikes have. */
function resolveAlignment(drafts: readonly Draft[]): Draft[] {
  const votes = new Map<string, Map<Alignment, number>>();
  for (const draft of drafts.filter((d) => d.confident)) {
    const tally = votes.get(signature(draft)) ?? new Map<Alignment, number>();
    tally.set(draft.align, (tally.get(draft.align) ?? 0) + 1);
    votes.set(signature(draft), tally);
  }
  return drafts.map((draft) => {
    if (draft.confident) return draft;
    const tally = votes.get(signature(draft));
    const winner = tally && [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return winner ? { ...draft, align: winner } : draft;
  });
}

function toDraft(lines: NonEmpty<Line>, content: Content): Draft {
  const [first, second] = lines;
  const align = alignmentOf(lines, content);
  const pitches = lines.flatMap((line, index) => {
    const previous = lines[index - 1];
    return previous ? [line.baseline - previous.baseline] : [];
  });
  const textLeft = second?.left ?? first.left;

  return {
    runs: toRuns(lines),
    ...(first.marker && { marker: first.marker }),
    left: align === 'center' || align === 'right' ? content.left : textLeft,
    right: Math.max(content.right, ...lines.map((line) => line.right)),
    align,
    page: first.page,
    firstBaseline: first.baseline,
    lastBaseline: lastOf(lines).baseline,
    size: first.size,
    pitch: pitches.length ? median(pitches) : null,
    hasMarker: Boolean(first.marker),
    confident: lines.length >= 3,
  };
}

export function segment(pages: readonly RawPage[]): ResumeLayout {
  const lines = pages.flatMap((page, index) =>
    page.lines.map((raw) => toLine(index, raw)).filter((line) => line !== null),
  );

  const rules = pages.flatMap((page, index) =>
    page.rules.map((rule) => ({ ...rule, page: index })),
  );
  const content: Content = {
    left: Math.min(...lines.map((line) => line.marker?.x ?? line.left)),
    right: Math.max(...lines.map((line) => line.right), ...rules.map((rule) => rule.x2)),
    pitch: typicalPitches(lines),
  };

  // 1. Group lines into paragraphs.
  const groups: [Line, ...Line[]][] = [];
  for (const line of lines) {
    const current = groups.at(-1);
    if (current && !startsParagraph(current, line, content)) current.push(line);
    else groups.push([line]);
  }
  const [firstDraft, ...otherDrafts] = resolveAlignment(
    groups.map((group) => toDraft(group, content)),
  );
  if (!firstDraft) throw new Error('The PDF has no extractable text.');
  const drafts = [firstDraft, ...otherDrafts];

  // 2. Single-line paragraphs borrow the document's typical line spacing for their size.
  const ratios = drafts.flatMap((d) => (d.pitch === null ? [] : [d.pitch / d.size]));
  const ratio = ratios.length ? median(ratios) : 1.2;

  // 3. Spacing: measured between neighbours on a page; at a page top, the usual spacing for that
  //    kind of paragraph (the output is pageless, so source page breaks disappear).
  const measured = drafts.map((draft, index) => {
    const previous = drafts[index - 1];
    return previous?.page === draft.page ? draft.firstBaseline - previous.lastBaseline : null;
  });
  const typicalSpacing = (draft: Draft) => {
    const similar = drafts.flatMap((other, index) => {
      const space = measured[index];
      return space != null && other.size === draft.size && other.hasMarker === draft.hasMarker
        ? [space]
        : [];
    });
    return similar.length ? median(similar) : draft.size * ratio;
  };

  const paragraphs: Paragraph[] = drafts.map((draft, index) => {
    const ownRules: Rule[] = rules
      .filter((rule) => rule.page === draft.page)
      .filter(
        (rule) => rule.y >= draft.lastBaseline - 1 && rule.y - draft.lastBaseline < draft.size * 2,
      )
      .filter((rule) => {
        // Belongs to the closest paragraph above it.
        const next = drafts[index + 1];
        return !(next?.page === draft.page && next.lastBaseline <= rule.y + 1);
      })
      .map((rule) => ({
        x1: rule.x1,
        x2: rule.x2,
        offset: rule.y - draft.lastBaseline,
        thickness: rule.thickness,
        color: rule.color,
      }));

    return {
      id: `p${index + 1}`,
      runs: draft.runs,
      ...(draft.marker && { marker: draft.marker }),
      left: draft.left,
      right: draft.right,
      align: draft.align,
      lineHeight: draft.pitch ?? draft.size * ratio,
      spaceBefore: index === 0 ? 0 : (measured[index] ?? typicalSpacing(draft)),
      rules: ownRules,
    };
  });

  const [firstPage] = pages;
  return {
    pageWidth: firstPage?.width ?? 0,
    pageHeight: firstPage?.height ?? 0,
    firstBaseline: firstDraft.firstBaseline,
    lastBaseline: Math.max(...drafts.map((draft) => draft.lastBaseline)),
    pageBackground: firstPage?.background ?? '#ffffff',
    paragraphs,
  };
}
