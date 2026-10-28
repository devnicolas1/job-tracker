import fs from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { renderLayout } from '@/core/resume-document/render';
import { ValidationError } from '@/core/shared/errors';
import { createTestServices, sampleResumeLayout } from '@/core/testing/fixtures';

let pdf: Uint8Array;
let otherPdf: Uint8Array;

beforeAll(async () => {
  pdf = new Uint8Array(await renderLayout(sampleResumeLayout));
  otherPdf = new Uint8Array(
    await renderLayout({
      ...sampleResumeLayout,
      paragraphs: sampleResumeLayout.paragraphs.slice(0, 3),
    }),
  );
});

describe('resume service', () => {
  it('stores one PDF per language and replaces it on re-upload', async () => {
    const { resumes } = createTestServices();
    await resumes.upload({ language: 'en', fileName: 'cv.pdf', bytes: pdf });
    await resumes.upload({ language: 'en', fileName: 'cv-v2.pdf', bytes: otherPdf });

    const stored = resumes.get('en');
    expect(stored?.meta).toMatchObject({ fileName: 'cv-v2.pdf', sizeBytes: otherPdf.byteLength });
    expect(fs.readFileSync(stored?.absolutePath ?? '')).toEqual(Buffer.from(otherPdf));
    expect(await resumes.readBytes('en')).toEqual(otherPdf);
    expect(resumes.list()).toHaveLength(1);
  });

  it('identifies PDFs by content, not by file name, and needs a text layer', async () => {
    const { resumes } = createTestServices();
    const upload = (bytes: Uint8Array) =>
      resumes.upload({ language: 'pt', fileName: 'cv.pdf', bytes });

    await expect(upload(new TextEncoder().encode('<script>'))).rejects.toThrow(ValidationError);
    await expect(upload(new TextEncoder().encode('%PDF-1.7 broken'))).rejects.toThrow(
      'could not be read',
    );
  });

  it('keeps only the base name of uploaded files', async () => {
    const { resumes } = createTestServices();
    const file = await resumes.upload({ language: 'pt', fileName: '../../etc/cv.pdf', bytes: pdf });
    expect(file.fileName).toBe('cv.pdf');
  });
});
