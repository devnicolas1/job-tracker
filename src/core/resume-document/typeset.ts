import { sameStyle, type TextRun, type TextStyle } from './model';

/*
 * Word-processor line breaking: words are placed greedily and a line ends when the next word no
 * longer fits. Spaces never shrink (react-pdf's own breaker squeezes them by up to a third, which
 * moves line breaks away from the source document's).
 */

export type Measure = (text: string, style: TextStyle) => number;

export interface TypesetLine {
  /** The line's text, spaces included, as styled runs. */
  readonly runs: readonly TextRun[];
  /** The same text split into words, each keeping its trailing space but the last: for justifying. */
  readonly words: readonly (readonly TextRun[])[];
}

interface Piece {
  readonly text: string;
  readonly style: TextStyle;
}

interface Word {
  readonly pieces: Piece[];
  /** Space(s) that follow the word, if any. */
  readonly space: Piece | null;
}

const styleOf = ({ text: _text, ...style }: TextRun): TextStyle => style;

/** Splits runs into words at spaces (like Google Docs, never at hyphens). */
function toWords(runs: readonly TextRun[]): Word[] {
  const words: Word[] = [];
  let pieces: Piece[] = [];
  const append = (char: string, style: TextStyle) => {
    const last = pieces.at(-1);
    if (last && sameStyle(last.style, style))
      pieces[pieces.length - 1] = { text: last.text + char, style };
    else pieces.push({ text: char, style });
  };
  const finish = (space: Piece | null) => {
    const previous = words.at(-1);
    if (pieces.length > 0) words.push({ pieces, space });
    else if (space && previous) {
      // Consecutive spaces belong to the word before them.
      words.pop();
      words.push({
        ...previous,
        space: { text: (previous.space?.text ?? '') + space.text, style: space.style },
      });
    }
    pieces = [];
  };

  for (const run of runs) {
    const style = styleOf(run);
    for (const char of run.text) {
      if (char === ' ') finish({ text: ' ', style });
      else append(char, style);
    }
  }
  finish(null);
  return words;
}

function mergeRuns(pieces: readonly Piece[]): TextRun[] {
  const runs: TextRun[] = [];
  for (const { text, style } of pieces) {
    const last = runs.at(-1);
    if (last && sameStyle(styleOf(last), style))
      runs[runs.length - 1] = { ...last, text: last.text + text };
    else runs.push({ ...style, text });
  }
  return runs;
}

export function breakLines(
  runs: readonly TextRun[],
  width: number,
  measure: Measure,
): TypesetLine[] {
  const words = toWords(runs);
  const widthOf = (pieces: readonly Piece[]) =>
    pieces.reduce((sum, piece) => sum + measure(piece.text, piece.style), 0);

  const lines: Word[][] = [];
  let line: Word[] = [];
  let lineWidth = 0;

  for (const word of words) {
    const previousSpace = line.at(-1)?.space;
    const gap = previousSpace ? measure(previousSpace.text, previousSpace.style) : 0;
    const wordWidth = widthOf(word.pieces);
    // A small epsilon absorbs float noise; a word that is wider than the line goes on its own.
    if (line.length > 0 && lineWidth + gap + wordWidth > width + 0.01) {
      lines.push(line);
      line = [];
      lineWidth = 0;
    }
    lineWidth += (line.length > 0 ? gap : 0) + wordWidth;
    line.push(word);
  }
  if (line.length > 0) lines.push(line);

  return lines.map((lineWords) => {
    const withSpaces = lineWords.map((word, index) =>
      index < lineWords.length - 1 && word.space ? [...word.pieces, word.space] : word.pieces,
    );
    return { runs: mergeRuns(withSpaces.flat()), words: withSpaces.map(mergeRuns) };
  });
}
