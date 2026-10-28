import { describe, expect, it } from 'vitest';

import type { TextRun, TextStyle } from './model';
import { breakLines, type Measure } from './typeset';

const regular: TextStyle = {
  font: { family: 'Mono', bold: false, italic: false },
  size: 10,
  color: '#000000',
};
const bold: TextStyle = { ...regular, font: { ...regular.font, bold: true } };
/** Every character is 1pt wide: widths equal character counts. */
const measure: Measure = (text) => text.length;
const text = (runs: readonly TextRun[]) => runs.map((run) => run.text).join('');

describe('breakLines', () => {
  it('breaks greedily without shrinking spaces', () => {
    const lines = breakLines([{ ...regular, text: 'aaaa bbbb cccc dd' }], 9, measure);
    expect(lines.map((line) => text(line.runs))).toEqual(['aaaa bbbb', 'cccc dd']);
  });

  it('fits a word that lands exactly on the edge', () => {
    expect(breakLines([{ ...regular, text: 'aaaa bbbb' }], 9, measure)).toHaveLength(1);
  });

  it('keeps styles across words and never breaks at hyphens', () => {
    const lines = breakLines(
      [
        { ...bold, text: 'Lead: ' },
        { ...regular, text: 'multi-company work' },
      ],
      19,
      measure,
    );
    expect(lines.map((line) => text(line.runs))).toEqual(['Lead: multi-company', 'work']);
    expect(lines[0]?.runs.map((run) => run.font.bold)).toEqual([true, false]);
  });

  it('exposes words with their trailing spaces for justification', () => {
    const [line] = breakLines([{ ...regular, text: 'one two three' }], 50, measure);
    expect(line?.words.map(text)).toEqual(['one ', 'two ', 'three']);
  });
});
