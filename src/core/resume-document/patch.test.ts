import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/core/shared/errors';

import type { Paragraph, ResumeLayout, TextStyle } from './model';
import { plainText } from './model';
import { toOutline } from './outline';
import { applyEdits } from './patch';

const regular: TextStyle = {
  font: { family: 'Calibri', bold: false, italic: false },
  size: 10.5,
  color: '#000000',
};
const bold: TextStyle = { ...regular, font: { ...regular.font, bold: true } };
const navy: TextStyle = { ...bold, size: 11.5, color: '#1f3a5f' };

const paragraph = (id: string, overrides: Partial<Paragraph>): Paragraph => ({
  id,
  runs: [],
  left: 50,
  right: 545,
  align: 'left',
  lineHeight: 12.8,
  spaceBefore: 15,
  rules: [],
  ...overrides,
});

const layout: ResumeLayout = {
  pageWidth: 596,
  pageHeight: 842,
  firstBaseline: 60,
  lastBaseline: 790,
  pageBackground: '#ffffff',
  paragraphs: [
    paragraph('p1', {
      runs: [{ ...navy, text: 'EXPERIENCE' }],
      rules: [{ x1: 50, x2: 545, offset: 5.5, thickness: 1.3, color: '#1f3a5f' }],
    }),
    paragraph('p2', {
      runs: [
        { ...bold, text: 'Billing: ' },
        { ...regular, text: 'led the migration.' },
      ],
      marker: { text: '•', x: 56, style: regular },
      left: 68,
    }),
    paragraph('p3', {
      runs: [{ ...regular, text: 'Old bullet.' }],
      marker: { text: '•', x: 56, style: regular },
      left: 68,
    }),
  ],
};

describe('toOutline', () => {
  it('lists paragraphs with ids, markers and emphasis', () => {
    expect(toOutline(layout)).toBe(
      '[p1] **EXPERIENCE**\n[p2] • **Billing:** led the migration.\n[p3] • Old bullet.',
    );
  });
});

describe('applyEdits', () => {
  it('replaces text while keeping the paragraph look', () => {
    const [, edited] = applyEdits(layout, [
      { op: 'replace', id: 'p2', text: '• **Payments:** led a *zero-downtime* migration.' },
    ]).paragraphs;

    expect(edited?.marker).toEqual(layout.paragraphs[1]?.marker);
    expect(edited?.runs).toEqual([
      { ...bold, text: 'Payments:' },
      { ...regular, text: ' led a ' },
      { ...regular, font: { ...regular.font, italic: true }, text: 'zero-downtime' },
      { ...regular, text: ' migration.' },
    ]);
  });

  it('inserts paragraphs modelled on another, in order, and deletes', () => {
    const result = applyEdits(layout, [
      { op: 'delete', id: 'p3' },
      { op: 'insert', after: 'p2', text: '**CI/CD:** standardised pipelines.' },
      { op: 'insert', after: 'p2', like: 'p1', text: 'PROJECTS' },
    ]);

    expect(result.paragraphs.map((p) => [p.id, plainText(p)])).toEqual([
      ['p1', 'EXPERIENCE'],
      ['p2', 'Billing: led the migration.'],
      ['p2.1', 'CI/CD: standardised pipelines.'],
      ['p2.2', 'PROJECTS'],
    ]);
    // A heading modelled on p1 brings its colour, size and rule.
    expect(result.paragraphs[3]?.rules).toEqual(layout.paragraphs[0]?.rules);
    expect(result.paragraphs[3]?.runs[0]).toMatchObject({ color: '#1f3a5f', size: 11.5 });
  });

  it('rejects unknown ids and empty text', () => {
    expect(() => applyEdits(layout, [{ op: 'delete', id: 'p9' }])).toThrow(ValidationError);
    expect(() => applyEdits(layout, [{ op: 'replace', id: 'p2', text: ' • ' }])).toThrow(
      ValidationError,
    );
  });
});
