/*
 * Layout model of a résumé, measured from the user's own PDF. Every style here (fonts, sizes,
 * colours, indents, spacing) is read from the source document; nothing is hard-coded, so a
 * tailored résumé always looks like the current base résumé. Units are PDF points, y grows down.
 */

export interface FontFace {
  /** Family as named in the PDF, without subset prefix or style suffix, e.g. "Calibri". */
  readonly family: string;
  readonly bold: boolean;
  readonly italic: boolean;
}

export interface TextStyle {
  readonly font: FontFace;
  readonly size: number;
  /** `#rrggbb` */
  readonly color: string;
}

export interface TextRun extends TextStyle {
  readonly text: string;
}

/** A horizontal line drawn under a paragraph, e.g. a section-heading rule. */
export interface Rule {
  readonly x1: number;
  readonly x2: number;
  /** Distance from the paragraph's last baseline to the rule's centre. */
  readonly offset: number;
  readonly thickness: number;
  readonly color: string;
}

export type Alignment = 'left' | 'center' | 'right' | 'justify';

export interface Paragraph {
  /** Stable within one base document: `p1`, `p2`… in reading order. */
  readonly id: string;
  readonly runs: readonly TextRun[];
  /** Bullet glyph drawn in the hanging indent, if any. */
  readonly marker?: { readonly text: string; readonly x: number; readonly style: TextStyle };
  /** Left edge of the text (all lines; the marker hangs to its left). */
  readonly left: number;
  /** Right edge lines wrap at. */
  readonly right: number;
  readonly align: Alignment;
  /** Baseline-to-baseline distance between the paragraph's lines. */
  readonly lineHeight: number;
  /** Distance from the previous paragraph's last baseline to this one's first baseline. */
  readonly spaceBefore: number;
  readonly rules: readonly Rule[];
}

export interface ResumeLayout {
  readonly pageWidth: number;
  readonly pageHeight: number;
  /** Baseline of the first line on a page / lowest baseline allowed on a page. */
  readonly firstBaseline: number;
  readonly lastBaseline: number;
  readonly pageBackground: string;
  readonly paragraphs: readonly Paragraph[];
}

export const plainText = (paragraph: Pick<Paragraph, 'runs'>) =>
  paragraph.runs.map((run) => run.text).join('');

export const sameStyle = (a: TextStyle, b: TextStyle) =>
  a.size === b.size &&
  a.color === b.color &&
  a.font.family === b.font.family &&
  a.font.bold === b.font.bold &&
  a.font.italic === b.font.italic;
