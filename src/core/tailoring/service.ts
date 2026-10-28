import path from 'node:path';

import { checksumOf, layoutOf } from '@/core/resume-document/document';
import { toOutline } from '@/core/resume-document/outline';
import { applyEdits } from '@/core/resume-document/patch';
import { renderLayout } from '@/core/resume-document/render';
import type { ResumeService } from '@/core/resumes/service';
import { NotFoundError, ValidationError } from '@/core/shared/errors';
import type { ResumeLanguage } from '@/core/shared/schemas';
import { parseInput } from '@/core/shared/validation';

import { resumeTailoringInputSchema, type ResumeTailoring } from './schemas';

export type TailoringStatus = 'ready' | 'base-missing' | 'base-changed';

export interface RenderedResume {
  readonly fileName: string;
  readonly pdf: Buffer;
}

/**
 * Tailored résumés are the user's own PDF plus text edits: résumé → tailored, never through a
 * template. The base is re-read on every render, so the output always matches it.
 */
export function createTailoredResumeService(deps: { resumes: ResumeService }) {
  async function loadBase(language: ResumeLanguage) {
    const stored = deps.resumes.get(language);
    if (!stored) throw new NotFoundError('Base résumé', language);
    const bytes = await deps.resumes.readBytes(language);
    return { stored, bytes, checksum: checksumOf(bytes) };
  }

  return {
    /** The base résumé as numbered paragraphs, for the agent to write edits against. */
    async outline(language: ResumeLanguage): Promise<{ checksum: string; text: string }> {
      const { bytes, checksum } = await loadBase(language);
      return { checksum, text: toOutline(layoutOf(bytes)) };
    },

    /** Validates edits against the current base résumé and pins them to its version. */
    async prepare(input: unknown): Promise<ResumeTailoring> {
      const tailoring = parseInput(resumeTailoringInputSchema, input);
      const { bytes, checksum } = await loadBase(tailoring.language);
      applyEdits(layoutOf(bytes), tailoring.edits);
      return { ...tailoring, baseChecksum: checksum };
    },

    async status(tailoring: ResumeTailoring): Promise<TailoringStatus> {
      if (!deps.resumes.get(tailoring.language)) return 'base-missing';
      const bytes = await deps.resumes.readBytes(tailoring.language);
      return checksumOf(bytes) === tailoring.baseChecksum ? 'ready' : 'base-changed';
    },

    async render(tailoring: ResumeTailoring, company: string): Promise<RenderedResume> {
      const { stored, bytes, checksum } = await loadBase(tailoring.language);
      if (checksum !== tailoring.baseChecksum) {
        throw new ValidationError(
          'The base résumé was replaced after this one was tailored. Ask the agent to tailor it again.',
        );
      }
      const stem = path.parse(stored.meta.fileName).name;
      const safeCompany = company
        .replace(/[^\p{L}\p{N} .&-]+/gu, '')
        .replace(/[\s.]+$/, '')
        .trim();
      return {
        fileName: `${stem} - ${safeCompany}.pdf`,
        pdf: await renderLayout(applyEdits(layoutOf(bytes), tailoring.edits)),
      };
    },
  };
}

export type TailoredResumeService = ReturnType<typeof createTailoredResumeService>;
