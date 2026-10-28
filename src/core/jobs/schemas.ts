import { z } from 'zod';

import {
  employmentTypeSchema,
  longText,
  resumeLanguageSchema,
  shortText,
  stringListSchema,
  urlSchema,
  workplaceTypeSchema,
} from '@/core/shared/schemas';
import { resumeTailoringInputSchema, type ResumeTailoring } from '@/core/tailoring/schemas';

/**
 * Pipeline a job moves through. `dismissed` records postings the agent reviewed and rejected, so
 * future searches skip them without spending tokens on them again.
 */
export const JOB_STATUSES = [
  'new',
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'dismissed',
] as const;
export const jobStatusSchema = z.enum(JOB_STATUSES);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobSourceSchema = z
  .string()
  .regex(/^[a-z0-9-]{2,40}$/, 'Use a lowercase slug, e.g. "linkedin".')
  .describe('Where the posting came from, e.g. "linkedin"');

export const jobPostingSchema = z.object({
  source: jobSourceSchema,
  externalId: shortText(200).describe('Stable id at the source (LinkedIn job id, URL hash…)'),
  url: urlSchema,
  title: shortText(),
  company: shortText(),
  location: shortText().optional(),
  workplaceType: workplaceTypeSchema.optional(),
  employmentType: employmentTypeSchema.optional(),
  seniority: shortText(80).optional(),
  salary: shortText(120).optional(),
  postedAt: z.iso.date().optional(),
  language: resumeLanguageSchema.optional().describe('Language the posting is written in'),
  description: longText(40_000).optional(),
});
export type JobPosting = z.infer<typeof jobPostingSchema>;

export const jobAssessmentSchema = z.object({
  matchScore: z.int().min(0).max(100).describe('0–100 fit between the profile and the posting'),
  matchSummary: longText(1500).describe('Why this is (or is not) a good fit, 2–4 sentences'),
  strengths: stringListSchema(200, 8).default([]),
  gaps: stringListSchema(200, 8).default([]),
});
export type JobAssessment = z.infer<typeof jobAssessmentSchema>;

export const saveJobSchema = jobPostingSchema.extend({
  assessment: jobAssessmentSchema.optional(),
  tailoredResume: resumeTailoringInputSchema.optional(),
  status: jobStatusSchema.optional().describe('Defaults to "new"; existing statuses are kept'),
});
export type SaveJobInput = z.input<typeof saveJobSchema>;

export interface Job extends JobPosting {
  readonly id: string;
  readonly status: JobStatus;
  readonly notes: string | null;
  readonly assessment: JobAssessment | null;
  readonly tailoredResume: ResumeTailoring | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly statusChangedAt: Date;
}

export type JobSummary = Omit<Job, 'description' | 'tailoredResume'> & {
  readonly hasTailoredResume: boolean;
};

export const jobFilterSchema = z.object({
  statuses: z.array(jobStatusSchema).optional(),
  minScore: z.int().min(0).max(100).optional(),
  query: z.string().trim().max(200).optional(),
  limit: z.int().min(1).max(500).optional(),
});
export type JobFilter = z.infer<typeof jobFilterSchema>;
