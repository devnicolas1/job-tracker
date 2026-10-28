import * as mupdf from 'mupdf';

import type { FontFace, TextStyle } from './model';

/*
 * MuPDF adapter: the only module that knows about MuPDF. It turns a PDF into raw, positioned
 * characters and horizontal rules; turning those into paragraphs is `segment.ts`'s job.
 */

export interface RawChar {
  readonly char: string;
  /** Baseline origin. */
  readonly x: number;
  readonly y: number;
  /** Right edge of the glyph. */
  readonly right: number;
  readonly style: TextStyle;
}

export interface RawLine {
  readonly chars: readonly RawChar[];
}

export interface RawRule {
  readonly x1: number;
  readonly x2: number;
  readonly y: number;
  readonly thickness: number;
  readonly color: string;
}

export interface RawPage {
  readonly width: number;
  readonly height: number;
  readonly background: string | null;
  readonly lines: readonly RawLine[];
  readonly rules: readonly RawRule[];
}

/** Geometry is kept to 1/100 pt: far below visibility, and it keeps re-extraction stable. */
const round = (value: number) => Math.round(value * 100) / 100;

const hexByte = (value: number) =>
  Math.round(Math.min(1, Math.max(0, value)) * 255)
    .toString(16)
    .padStart(2, '0');

/** Gray, RGB or CMYK components (0–1) → `#rrggbb`. */
export function toHex(color: readonly number[]): string {
  let rgb: number[];
  if (color.length === 1) rgb = [color[0] ?? 0, color[0] ?? 0, color[0] ?? 0];
  else if (color.length === 4) {
    const [c = 0, m = 0, y = 0, k = 0] = color;
    rgb = [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
  } else rgb = [...color];
  return `#${rgb.map(hexByte).join('')}`;
}

/** "ABCDEF+Calibri-BoldItalic" → { family: "Calibri", bold: true, italic: true } */
export function parseFontName(name: string, flags: { bold: boolean; italic: boolean }): FontFace {
  const base = name.replace(/^[A-Z]{6}\+/, '');
  const [family = base, style = ''] = base.split(/[-,]/);
  return {
    family: family.replace(/(MT|PS|PSMT)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'),
    bold: flags.bold || /bold|black|heavy|semibold/i.test(style),
    italic: flags.italic || /italic|oblique/i.test(style),
  };
}

interface Bounds {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

function pathBounds(path: mupdf.Path, ctm: mupdf.Matrix): Bounds | null {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    xs.push(ctm[0] * x + ctm[2] * y + ctm[4]);
    ys.push(ctm[1] * x + ctm[3] * y + ctm[5]);
  };
  path.walk({
    moveTo: add,
    lineTo: add,
    curveTo: (_x1, _y1, _x2, _y2, x, y) => {
      add(x, y);
    },
  });
  if (xs.length === 0) return null;
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

/** A wide, thin shape (stroked line or filled bar) is a horizontal rule. */
function toRule(bounds: Bounds, strokeWidth: number, color: number[]): RawRule | null {
  const thickness = bounds.y2 - bounds.y1 + strokeWidth;
  if (bounds.x2 - bounds.x1 < 30 || thickness > 4) return null;
  return {
    x1: round(bounds.x1),
    x2: round(bounds.x2),
    y: round((bounds.y1 + bounds.y2) / 2),
    thickness: round(thickness),
    color: toHex(color),
  };
}

export function readPdf(bytes: Uint8Array): RawPage[] {
  const document = mupdf.Document.openDocument(bytes, 'application/pdf');
  const pages: RawPage[] = [];

  for (let index = 0; index < document.countPages(); index++) {
    const page = document.loadPage(index);
    const [, , width, height] = page.getBounds();
    const lines: RawLine[] = [];
    let chars: RawChar[] = [];

    page.toStructuredText('preserve-whitespace').walk({
      beginLine: () => {
        chars = [];
      },
      onChar: (char, origin, font, size, quad, color) => {
        chars.push({
          char,
          x: round(origin[0]),
          y: round(origin[1]),
          right: round(Math.max(quad[2], quad[6])),
          style: {
            font: parseFontName(font.getName(), { bold: font.isBold(), italic: font.isItalic() }),
            size: Math.round(size * 100) / 100,
            color: toHex(color),
          },
        });
      },
      endLine: () => {
        if (chars.length > 0) lines.push({ chars });
      },
    });

    const rules: RawRule[] = [];
    let background: string | null = null;
    const device = new mupdf.Device({
      fillPath: (path, _evenOdd, ctm, _colorspace, color) => {
        const bounds = pathBounds(path, ctm);
        if (!bounds) return;
        const rule = toRule(bounds, 0, color);
        if (rule) rules.push(rule);
        // Only a fill covering the page is a background; other shapes are not reproduced.
        else if (bounds.x2 - bounds.x1 >= width * 0.9 && bounds.y2 - bounds.y1 >= height * 0.9) {
          background = toHex(color);
        }
      },
      strokePath: (path, stroke, ctm, _colorspace, color) => {
        const bounds = pathBounds(path, ctm);
        const rule = bounds && toRule(bounds, stroke.getLineWidth(), color);
        if (rule) rules.push(rule);
      },
    });
    page.run(device, mupdf.Matrix.identity);
    device.close();

    pages.push({ width, height, background, lines, rules });
  }
  return pages;
}
