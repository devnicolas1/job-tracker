import { z } from 'zod';

import { resumeLanguageSchema } from '@/core/shared/schemas';

const paragraphId = z.string().regex(/^p\d+$/, 'Use a paragraph id from the outline, e.g. "p12".');
const text = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .describe('Paragraph text; **bold**, *italic*; no bullet marker');

export const paragraphEditSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('replace'), id: paragraphId, text }),
  z.object({
    op: z.literal('insert'),
    after: paragraphId,
    like: paragraphId.optional().describe('Paragraph to copy the look from; defaults to `after`'),
    text,
  }),
  z.object({ op: z.literal('delete'), id: paragraphId }),
]);

/**
 * What the agent writes for a job: edits to the user's own résumé, addressed by paragraph id.
 * Edits carry text only; the look always comes from the base résumé.
 */
export const resumeTailoringInputSchema = z.object({
  language: resumeLanguageSchema.describe('Which base résumé to tailor; match the posting'),
  edits: z.array(paragraphEditSchema).min(1).max(150),
});

export const resumeTailoringSchema = resumeTailoringInputSchema.extend({
  /** Version of the base résumé the edits were written against: ids are only valid for it. */
  baseChecksum: z.string(),
});

export type ResumeTailoringInput = z.input<typeof resumeTailoringInputSchema>;
export type ResumeTailoring = z.infer<typeof resumeTailoringSchema>;
