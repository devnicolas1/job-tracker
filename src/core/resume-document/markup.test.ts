import { describe, expect, it } from 'vitest';

import { parseMarkup, toMarkup } from './markup';

const font = (bold: boolean, italic: boolean) => ({ family: 'Calibri', bold, italic });

describe('parseMarkup', () => {
  it('reads bold, italic and bold-italic segments', () => {
    expect(parseMarkup('**Dev - Acme -** *Feb 2023* plain ***both***')).toEqual([
      { text: 'Dev - Acme -', bold: true, italic: false },
      { text: ' ', bold: false, italic: false },
      { text: 'Feb 2023', bold: false, italic: true },
      { text: ' plain ', bold: false, italic: false },
      { text: 'both', bold: true, italic: true },
    ]);
  });

  it('leaves unpaired asterisks as text', () => {
    expect(parseMarkup('5 * 3 = 15')).toEqual([{ text: '5 * 3 = 15', bold: false, italic: false }]);
  });
});

describe('toMarkup', () => {
  it('round-trips runs, keeping spaces outside the markers', () => {
    const markup = toMarkup([
      { text: 'Lead: ', font: font(true, false) },
      { text: 'did things ', font: font(false, false) },
      { text: '(2023)', font: font(false, true) },
    ]);
    expect(markup).toBe('**Lead:** did things *(2023)*');
    expect(
      parseMarkup(markup)
        .map((segment) => segment.text)
        .join(''),
    ).toBe('Lead: did things (2023)');
  });
});
