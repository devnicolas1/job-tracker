import type { EmploymentType, ResumeLanguage, WorkplaceType } from '@/core/shared/schemas';

export const POSTED_WITHIN = ['day', 'week', 'month'] as const;
export type PostedWithin = (typeof POSTED_WITHIN)[number];

export const EXPERIENCE_LEVELS = [
  'internship',
  'entry',
  'associate',
  'mid-senior',
  'director',
  'executive',
] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export interface JobSearchQuery {
  readonly keywords: string;
  readonly location?: string | undefined;
  readonly workplaceTypes?: readonly WorkplaceType[] | undefined;
  readonly experienceLevels?: readonly ExperienceLevel[] | undefined;
  readonly postedWithin?: PostedWithin | undefined;
  /** Maximum number of listings to return. */
  readonly limit: number;
  /** Source-specific targets, e.g. company boards ("greenhouse:stripe") for `companies`. */
  readonly targets?: readonly string[] | undefined;
}

/** What a search results page shows: enough to triage a posting without opening it. */
export interface JobListing {
  readonly externalId: string;
  readonly url: string;
  readonly title: string;
  readonly company: string;
  readonly location?: string | undefined;
  readonly postedAt?: string | undefined;
  readonly salary?: string | undefined;
  readonly workplaceType?: WorkplaceType | undefined;
  /** Sources whose feeds carry full postings include them, so nothing is fetched twice. */
  readonly description?: string | undefined;
}

export interface JobDetails extends JobListing {
  readonly description: string;
  readonly seniority?: string | undefined;
  readonly employmentType?: EmploymentType | undefined;
  readonly applicants?: string | undefined;
  readonly language?: ResumeLanguage | undefined;
}

/**
 * A place jobs can be found. Implementations must be polite (throttled) and resilient to markup
 * changes: missing optional fields are fine, missing ids/titles drop the listing.
 */
export interface JobSource {
  readonly id: string;
  /** Canonical, shareable URL of a posting. */
  jobUrl(externalId: string): string;
  search(query: JobSearchQuery): Promise<JobListing[]>;
  getDetails(externalId: string): Promise<JobDetails>;
}
