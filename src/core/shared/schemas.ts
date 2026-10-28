import { z } from 'zod';

import './zod-config';

/** Month-precision date (`2024-03`). Résumés rarely need day precision. */
export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the YYYY-MM format.')
  .describe('Month-precision date, YYYY-MM');

export type YearMonth = z.infer<typeof yearMonthSchema>;

export const shortText = (max = 200) => z.string().trim().min(1).max(max);
export const longText = (max = 5000) => z.string().trim().min(1).max(max);
export const urlSchema = z.url({ protocol: /^https?$/ }).max(2048);

/** Ordered list of short strings (bullet points, technologies…), de-duplicated. */
export const stringListSchema = (itemMax = 500, listMax = 50) =>
  z
    .array(z.string().trim().min(1).max(itemMax))
    .max(listMax)
    .transform((items) => [...new Set(items)]);

export const RESUME_LANGUAGES = ['en', 'pt'] as const;
export const resumeLanguageSchema = z.enum(RESUME_LANGUAGES);
export type ResumeLanguage = z.infer<typeof resumeLanguageSchema>;

export const WORKPLACE_TYPES = ['remote', 'hybrid', 'onsite'] as const;
export const workplaceTypeSchema = z.enum(WORKPLACE_TYPES);
export type WorkplaceType = z.infer<typeof workplaceTypeSchema>;

export const EMPLOYMENT_TYPES = [
  'full-time',
  'part-time',
  'contract',
  'freelance',
  'internship',
  'temporary',
] as const;
export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES);
export type EmploymentType = z.infer<typeof employmentTypeSchema>;

/** Validates that a period does not end before it starts (lexicographic order works for YYYY-MM). */
export function refinePeriod(
  value: { startDate?: string | undefined; endDate?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'End date must be after the start date.',
    });
  }
}
