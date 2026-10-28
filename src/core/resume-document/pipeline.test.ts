import { describe, expect, it } from 'vitest';

import { sampleResumeLayout as layout } from '@/core/testing/fixtures';

import { plainText } from './model';
import { readPdf } from './read-pdf';
import { renderLayout } from './render';
import { segment } from './segment';

describe('render → extract', () => {
  it('recovers the rendered model, so tailored résumés keep the source look', async () => {
    const extracted = segment(readPdf(await renderLayout(layout)));

    expect(extracted.paragraphs.map(plainText)).toEqual(layout.paragraphs.map(plainText));
    extracted.paragraphs.forEach((paragraph, index) => {
      const expected = layout.paragraphs[index]!;
      expect(paragraph.align).toBe(expected.align);
      expect(paragraph.left).toBeCloseTo(expected.left, 0);
      expect(paragraph.marker?.x ?? null).toEqual(
        expected.marker ? expect.closeTo(expected.marker.x, 0) : null,
      );
      expect(
        paragraph.runs.map(({ size, color, font }) => ({ size, color, bold: font.bold })),
      ).toEqual(expected.runs.map(({ size, color, font }) => ({ size, color, bold: font.bold })));
      if (index > 0) expect(paragraph.spaceBefore).toBeCloseTo(expected.spaceBefore, 0);
    });
    expect(extracted.paragraphs[2]!.lineHeight).toBeCloseTo(12.8, 1);
    expect(extracted.paragraphs[1]!.rules).toEqual([
      expect.objectContaining({ offset: expect.closeTo(5.5, 0) as number, color: '#1f3a5f' }),
    ]);
  });

  it('is stable: rendering what was extracted gives the same layout again', async () => {
    const once = segment(readPdf(await renderLayout(layout)));
    const twice = segment(readPdf(await renderLayout(once)));
    expect(twice.paragraphs).toEqual(once.paragraphs);
  });

  it('is pageless: content longer than the source page grows one page instead of adding pages', async () => {
    const [bullet] = layout.paragraphs.filter((paragraph) => paragraph.marker);
    const long = {
      ...layout,
      paragraphs: [
        ...layout.paragraphs,
        ...Array.from({ length: 80 }, (_, index) => ({ ...bullet!, id: `x${index}` })),
      ],
    };

    const pages = readPdf(await renderLayout(long));
    expect(pages).toHaveLength(1);
    expect(pages[0]!.height).toBeGreaterThan(layout.pageHeight);
    expect(pages[0]!.width).toBe(layout.pageWidth);
  });

  it('leaves the same margin below the last line as above the first one', async () => {
    const [page] = readPdf(await renderLayout(layout));
    const glyphs = page!.lines.flatMap((line) => line.chars).filter(({ char }) => char.trim());
    // Both measured from a baseline, one font size away from the text: like for like.
    const first = glyphs.reduce((a, b) => (b.y < a.y ? b : a));
    const last = glyphs.reduce((a, b) => (b.y > a.y ? b : a));
    const topMargin = first.y - first.style.size;
    const bottomMargin = page!.height - last.y;

    expect(bottomMargin).toBeGreaterThan(40);
    expect(Math.abs(bottomMargin - topMargin)).toBeLessThan(6);
  });
});
