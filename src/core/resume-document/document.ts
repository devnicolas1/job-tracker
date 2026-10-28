import { createHash } from 'node:crypto';

import { ValidationError } from '@/core/shared/errors';

import type { ResumeLayout } from './model';
import { readPdf } from './read-pdf';
import { segment } from './segment';

export const checksumOf = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex').slice(0, 16);

const layouts = new Map<string, ResumeLayout>();

/** Layout of a base résumé PDF, cached by content (extraction takes ~100 ms). */
export function layoutOf(bytes: Uint8Array): ResumeLayout {
  const checksum = checksumOf(bytes);
  let layout = layouts.get(checksum);
  if (!layout) {
    let pages;
    try {
      pages = readPdf(bytes);
    } catch {
      throw new ValidationError('This file could not be read as a PDF.');
    }
    if (!pages.some((page) => page.lines.length > 0)) {
      throw new ValidationError(
        'This PDF has no selectable text (it looks scanned). Export it from your editor instead.',
      );
    }
    layout = segment(pages);
    layouts.set(checksum, layout);
  }
  return layout;
}
