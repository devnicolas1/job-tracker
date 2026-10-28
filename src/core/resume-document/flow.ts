import type { Paragraph, ResumeLayout } from './model';
import { breakLines, type Measure, type TypesetLine } from './typeset';

/*
 * Pageless layout: the whole résumé flows on a single page whose height fits the content, like
 * a Google Docs "pageless" document. Every gap between paragraphs is exactly the one measured in
 * the source, and the space below the last line mirrors the space above the first (page breaks of the source vanish:
 * paragraphs that started a page there get their usual spacing instead).
 */

export interface Metrics {
  readonly measure: Measure;
  /** Distance from a line box's top to the baseline of the paragraph's first line. */
  readonly ascentOf: (paragraph: Paragraph) => number;
}

export interface PlacedParagraph {
  readonly paragraph: Paragraph;
  readonly lines: readonly TypesetLine[];
  /** Gap between the previous box (or rule) and this paragraph's first line box. */
  readonly marginTop: number;
}

export interface FlowedResume {
  /** Space above the first line box; the same space is left below the last one. */
  readonly margin: number;
  /** Height of the single page: content plus both margins. */
  readonly height: number;
  readonly paragraphs: readonly PlacedParagraph[];
}

export function flow(layout: ResumeLayout, { measure, ascentOf }: Metrics): FlowedResume {
  const [first] = layout.paragraphs;
  if (!first) return { margin: 0, height: layout.pageHeight, paragraphs: [] };

  /** Space a paragraph's box (and its rule, if any) takes below its last baseline. */
  const depthBelow = (paragraph: Paragraph) => {
    const rule = paragraph.rules.at(-1);
    return rule ? rule.offset + rule.thickness / 2 : paragraph.lineHeight - ascentOf(paragraph);
  };

  const margin = layout.firstBaseline - ascentOf(first);
  const paragraphs: PlacedParagraph[] = [];
  // Baseline of the previous paragraph's last line, to know where the content ends.
  let lastBaseline = 0;

  layout.paragraphs.forEach((paragraph, index) => {
    const previous = layout.paragraphs[index - 1];
    const lines = breakLines(paragraph.runs, paragraph.right - paragraph.left, measure);
    const firstBaseline = previous
      ? lastBaseline + paragraph.spaceBefore
      : margin + ascentOf(paragraph);
    lastBaseline = firstBaseline + (lines.length - 1) * paragraph.lineHeight;

    paragraphs.push({
      paragraph,
      lines,
      // Baseline-to-baseline spacing from the source, converted to a gap between boxes.
      marginTop: previous ? paragraph.spaceBefore - depthBelow(previous) - ascentOf(paragraph) : 0,
    });
  });

  const last = layout.paragraphs.at(-1) ?? first;
  return { margin, height: Math.ceil(lastBaseline + depthBelow(last) + margin), paragraphs };
}
