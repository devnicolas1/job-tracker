import { z } from 'zod';

import {
  employmentTypeSchema,
  longText,
  refinePeriod,
  shortText,
  stringListSchema,
  urlSchema,
  workplaceTypeSchema,
  yearMonthSchema,
} from '@/core/shared/schemas';

/* -------------------------------------------------------------------------------------------------
 * Singleton documents
 * -----------------------------------------------------------------------------------------------*/

export const profileBasicsSchema = z.object({
  fullName: shortText(120),
  headline: shortText(160).optional().describe('e.g. "Senior Full-Stack Engineer"'),
  email: z.email().optional(),
  phone: shortText(40).optional(),
  location: shortText(120).optional().describe('City, region, country'),
  website: urlSchema.optional(),
  linkedin: urlSchema.optional(),
  github: urlSchema.optional(),
  summary: longText(3000).optional().describe('Professional summary, 3–6 sentences'),
});
export type ProfileBasics = z.infer<typeof profileBasicsSchema>;

export const SENIORITY_LEVELS = [
  'intern',
  'junior',
  'mid',
  'senior',
  'staff',
  'principal',
  'lead',
  'manager',
] as const;
export const senioritySchema = z.enum(SENIORITY_LEVELS);
export type Seniority = z.infer<typeof senioritySchema>;

/** What the job-hunting agent should look for. Drives search queries and fit scoring. */
export const jobPreferencesSchema = z.object({
  targetRoles: stringListSchema(120, 20).default([]).describe('Job titles to search for'),
  seniority: z.array(senioritySchema).default([]),
  workplaceTypes: z.array(workplaceTypeSchema).default([]),
  employmentTypes: z.array(employmentTypeSchema).default([]),
  locations: stringListSchema(120, 20).default([]).describe('Cities/countries, or "Worldwide"'),
  searchKeywords: stringListSchema(80, 30).default([]).describe('Must-have technologies/domains'),
  excludeKeywords: stringListSchema(80, 30)
    .default([])
    .describe('Deal-breakers: postings mentioning these are discarded'),
  companyBoards: stringListSchema(80, 100)
    .pipe(
      z.array(
        z
          .string()
          .regex(
            /^((greenhouse|lever|ashby):[\w.-]+|inhire:[\w.-]+\/[\w.-]+)$/i,
            'Use provider:company, e.g. greenhouse:stripe or inhire:magazineluiza/magalucloud',
          ),
      ),
    )
    .default([])
    .describe(
      'Company job boards to watch: greenhouse:stripe, lever:spotify, ashby:ramp, inhire:magazineluiza/magalucloud',
    ),
  salaryExpectation: shortText(120).optional(),
  openToRelocation: z.boolean().default(false),
  notes: longText(2000).optional().describe('Anything else the agent should weigh'),
});
export type JobPreferences = z.infer<typeof jobPreferencesSchema>;

export const EMPTY_PREFERENCES: JobPreferences = jobPreferencesSchema.parse({});

/* -------------------------------------------------------------------------------------------------
 * Repeatable sections
 * -----------------------------------------------------------------------------------------------*/

const highlights = stringListSchema(500, 20).default([]).describe('Achievement bullet points');
const technologies = stringListSchema(60, 40).default([]);

export const experienceSchema = z
  .object({
    company: shortText(),
    title: shortText(),
    location: shortText().optional(),
    employmentType: employmentTypeSchema.optional(),
    workplaceType: workplaceTypeSchema.optional(),
    startDate: yearMonthSchema,
    endDate: yearMonthSchema.optional().describe('Omit if this is the current position'),
    summary: longText(2000).optional(),
    highlights,
    technologies,
  })
  .superRefine(refinePeriod);

export const educationSchema = z
  .object({
    institution: shortText(),
    degree: shortText().describe('e.g. "BSc", "MBA", "Technical degree"'),
    field: shortText().optional(),
    startDate: yearMonthSchema.optional(),
    endDate: yearMonthSchema.optional(),
    grade: shortText(60).optional(),
    summary: longText(2000).optional(),
    highlights,
  })
  .superRefine(refinePeriod);

export const certificationSchema = z.object({
  name: shortText(),
  issuer: shortText(),
  issueDate: yearMonthSchema.optional(),
  expirationDate: yearMonthSchema.optional(),
  credentialId: shortText(120).optional(),
  url: urlSchema.optional(),
});

export const projectSchema = z
  .object({
    name: shortText(),
    role: shortText().optional(),
    url: urlSchema.optional(),
    repositoryUrl: urlSchema.optional(),
    startDate: yearMonthSchema.optional(),
    endDate: yearMonthSchema.optional(),
    summary: longText(2000).optional(),
    highlights,
    technologies,
  })
  .superRefine(refinePeriod);

export const SKILL_CATEGORIES = [
  'language',
  'framework',
  'library',
  'database',
  'cloud',
  'devops',
  'tool',
  'practice',
  'soft',
  'other',
] as const;
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

export const skillSchema = z.object({
  name: shortText(80),
  category: z.enum(SKILL_CATEGORIES),
  level: z.enum(SKILL_LEVELS).optional(),
  years: z.number().min(0).max(60).optional(),
});

export const LANGUAGE_PROFICIENCIES = ['native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'] as const;

export const languageSchema = z.object({
  name: shortText(60),
  proficiency: z.enum(LANGUAGE_PROFICIENCIES),
});

export const awardSchema = z.object({
  title: shortText(),
  issuer: shortText().optional(),
  date: yearMonthSchema.optional(),
  summary: longText(1000).optional(),
});

export const publicationSchema = z.object({
  title: shortText(300),
  publisher: shortText().optional(),
  date: yearMonthSchema.optional(),
  url: urlSchema.optional(),
  summary: longText(1000).optional(),
});

export const volunteeringSchema = z
  .object({
    organization: shortText(),
    role: shortText(),
    startDate: yearMonthSchema.optional(),
    endDate: yearMonthSchema.optional(),
    summary: longText(2000).optional(),
    highlights,
  })
  .superRefine(refinePeriod);

/**
 * Registry of every repeatable profile section. Adding a section is a one-line change here plus a
 * UI descriptor; storage, services and MCP tools pick it up automatically.
 */
export const profileSectionSchemas = {
  experience: experienceSchema,
  education: educationSchema,
  certification: certificationSchema,
  project: projectSchema,
  skill: skillSchema,
  language: languageSchema,
  award: awardSchema,
  publication: publicationSchema,
  volunteering: volunteeringSchema,
} as const;

export type ProfileSection = keyof typeof profileSectionSchemas;
export const PROFILE_SECTIONS = Object.keys(profileSectionSchemas) as ProfileSection[];
export const profileSectionSchema = z.enum(
  PROFILE_SECTIONS as [ProfileSection, ...ProfileSection[]],
);

export type SectionData<S extends ProfileSection> = z.output<(typeof profileSectionSchemas)[S]>;
export type SectionInput<S extends ProfileSection> = z.input<(typeof profileSectionSchemas)[S]>;

export interface ProfileEntry<S extends ProfileSection = ProfileSection> {
  readonly id: string;
  readonly section: S;
  readonly position: number;
  readonly data: SectionData<S>;
}

export type ProfileEntries = { readonly [S in ProfileSection]: readonly ProfileEntry<S>[] };

export interface Profile {
  readonly basics: ProfileBasics | null;
  readonly preferences: JobPreferences;
  readonly entries: ProfileEntries;
  readonly updatedAt: Date | null;
}
