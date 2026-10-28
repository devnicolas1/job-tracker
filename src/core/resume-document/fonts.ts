import fs from 'node:fs';
import path from 'node:path';

import { Font } from '@react-pdf/renderer';
import * as fontkit from 'fontkit';

import { getConfig } from '@/core/config';

import type { FontFace } from './model';

/*
 * Maps the fonts named in a PDF to complete fonts we can both measure and draw with. PDFs embed
 * only the glyphs they use, so new text needs a full font of the same design. Fonts come from
 * Fontsource (`npm i @fontsource/<name>` adds one), directly or through a metric-compatible
 * alias: Carlito has exactly Calibri's widths, so lines break in exactly the same places.
 */

const ALIASES: Readonly<Record<string, string>> = {
  calibri: 'carlito',
  cambria: 'caladea',
  arial: 'arimo',
  helvetica: 'arimo',
  'helvetica neue': 'arimo',
  'times new roman': 'tinos',
  times: 'tinos',
  'courier new': 'cousine',
  courier: 'cousine',
};

const FALLBACKS = { sans: 'arimo', serif: 'tinos', mono: 'cousine' } as const;

export interface ResolvedFont {
  readonly fontFamily: string;
  readonly fontWeight: 'normal' | 'bold';
  readonly fontStyle: 'normal' | 'italic';
  /** Ascent as a fraction of the font size: where react-pdf puts the baseline in a line box. */
  readonly ascent: number;
  /** Advance width of `text` at `size`: kerned, without ligatures. */
  readonly widthOf: (text: string, size: number) => number;
}

const fontsourceDir = (slug: string) =>
  path.join(getConfig().rootDir, 'node_modules/@fontsource', slug, 'files');

const fileFor = (slug: string, bold: boolean, italic: boolean) =>
  path.join(
    fontsourceDir(slug),
    `${slug}-latin-${bold ? 700 : 400}-${italic ? 'italic' : 'normal'}.woff`,
  );

const isInstalled = (slug: string) => fs.existsSync(fileFor(slug, false, false));

/** Registers a family's four variants with react-pdf, falling back to the closest one. */
const registerFamily = (() => {
  const done = new Set<string>();
  return (slug: string) => {
    if (done.has(slug)) return;
    done.add(slug);
    // Callers only register installed families, so the regular file always exists.
    const variant = (bold: boolean, italic: boolean) =>
      [fileFor(slug, bold, italic), fileFor(slug, bold, false)].find((file) =>
        fs.existsSync(file),
      ) ?? fileFor(slug, false, false);
    Font.register({
      family: slug,
      fonts: [
        { src: variant(false, false) },
        { src: variant(false, true), fontStyle: 'italic' },
        { src: variant(true, false), fontWeight: 'bold' },
        { src: variant(true, true), fontWeight: 'bold', fontStyle: 'italic' },
      ],
    });
  };
})();

const loaded = new Map<string, fontkit.Font>();
function load(file: string): fontkit.Font {
  let font = loaded.get(file);
  if (!font) {
    const opened = fontkit.openSync(file);
    if (!('unitsPerEm' in opened)) throw new Error(`${file} is a font collection, not a font.`);
    font = opened;
    loaded.set(file, font);
  }
  return font;
}

function slugFor(family: string): string {
  const name = family.toLowerCase();
  const candidate = ALIASES[name] ?? name.replace(/\s+/g, '-');
  if (isInstalled(candidate)) return candidate;
  if (/mono|courier|consol|code/.test(name)) return FALLBACKS.mono;
  if (/times|serif|georgia|garamond|cambria|book|roman/.test(name) && !name.includes('sans')) {
    return FALLBACKS.serif;
  }
  return FALLBACKS.sans;
}

const cache = new Map<string, ResolvedFont>();

export function resolveFont(face: FontFace): ResolvedFont {
  const key = `${face.family}|${face.bold}|${face.italic}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const slug = slugFor(face.family);
  registerFamily(slug);
  const file = [fileFor(slug, face.bold, face.italic), fileFor(slug, face.bold, false)].find((f) =>
    fs.existsSync(f),
  );
  const font = load(file ?? fileFor(slug, false, false));
  const scale = 1 / font.unitsPerEm;

  const resolved: ResolvedFont = {
    fontFamily: slug,
    fontWeight: face.bold ? 'bold' : 'normal',
    fontStyle: face.italic ? 'italic' : 'normal',
    ascent: font.ascent * scale,
    // Kerned, without ligatures: how word processors set text, and how the renderer draws it.
    widthOf: (text, size) =>
      font.layout(text, { liga: false, clig: false }).advanceWidth * scale * size,
  };
  cache.set(key, resolved);
  return resolved;
}

// Résumés never hyphenate words.
Font.registerHyphenationCallback((word) => [word]);
