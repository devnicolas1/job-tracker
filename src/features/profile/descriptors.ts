import {
  LANGUAGE_PROFICIENCIES,
  SENIORITY_LEVELS,
  SKILL_CATEGORIES,
  SKILL_LEVELS,
  type JobPreferences,
  type ProfileBasics,
  type ProfileSection,
  type SectionData,
  type SectionInput,
} from '@/core/profile/schemas';
import { EMPLOYMENT_TYPES, WORKPLACE_TYPES } from '@/core/shared/schemas';
import { formatPeriod, formatYearMonth } from '@/lib/format';

import { toOptions, type FieldsFor } from '../forms/fields';

/*
 * How each part of the profile is edited and summarised in the UI. Validation lives in the core
 * zod schemas; these descriptors only cover presentation.
 */

const employmentTypes = toOptions(EMPLOYMENT_TYPES);
const workplaceTypes = toOptions(WORKPLACE_TYPES, { onsite: 'On-site' });

export const basicsFields: FieldsFor<ProfileBasics> = [
  { name: 'fullName', label: 'Full name', kind: 'text', required: true },
  { name: 'headline', label: 'Headline', kind: 'text', placeholder: 'Senior Full-Stack Engineer' },
  { name: 'email', label: 'Email', kind: 'email' },
  { name: 'phone', label: 'Phone', kind: 'tel', placeholder: '+55 41 99999-9999' },
  { name: 'location', label: 'Location', kind: 'text', placeholder: 'São Paulo, SP, Brazil' },
  { name: 'website', label: 'Website', kind: 'url', placeholder: 'https://' },
  {
    name: 'linkedin',
    label: 'LinkedIn',
    kind: 'url',
    placeholder: 'https://www.linkedin.com/in/…',
  },
  { name: 'github', label: 'GitHub', kind: 'url', placeholder: 'https://github.com/…' },
  {
    name: 'summary',
    label: 'Professional summary',
    kind: 'textarea',
    wide: true,
    hint: 'Your default pitch. The agent rewrites it for each job.',
  },
];

export const preferencesFields: FieldsFor<JobPreferences> = [
  {
    name: 'targetRoles',
    label: 'Target roles',
    kind: 'tags',
    wide: true,
    placeholder: 'Backend Engineer, Full-Stack Developer',
    hint: 'Comma-separated. These become the search queries.',
  },
  {
    name: 'seniority',
    label: 'Seniority',
    kind: 'multiselect',
    wide: true,
    options: toOptions(SENIORITY_LEVELS),
  },
  { name: 'workplaceTypes', label: 'Workplace', kind: 'multiselect', options: workplaceTypes },
  {
    name: 'employmentTypes',
    label: 'Employment type',
    kind: 'multiselect',
    options: employmentTypes,
  },
  {
    name: 'locations',
    label: 'Locations',
    kind: 'tags',
    placeholder: 'Brazil, Portugal, Worldwide',
  },
  {
    name: 'salaryExpectation',
    label: 'Salary expectation',
    kind: 'text',
    placeholder: 'R$ 18k/month or USD 6k',
  },
  {
    name: 'searchKeywords',
    label: 'Must-have keywords',
    kind: 'tags',
    placeholder: 'TypeScript, Node.js',
  },
  {
    name: 'excludeKeywords',
    label: 'Deal-breakers',
    kind: 'tags',
    placeholder: 'PHP, on-call, crypto',
    hint: 'Postings mentioning these are discarded.',
  },
  {
    name: 'companyBoards',
    label: 'Company job boards to watch',
    kind: 'tags',
    wide: true,
    placeholder: 'greenhouse:stripe, lever:spotify, inhire:magazineluiza/magalucloud',
    hint: 'From the board URL: boards.greenhouse.io/stripe → greenhouse:stripe; magazineluiza.inhire.app/magalucloud → inhire:magazineluiza/magalucloud.',
  },
  { name: 'openToRelocation', label: 'Open to relocation', kind: 'checkbox', wide: true },
  {
    name: 'notes',
    label: 'Notes for the agent',
    kind: 'textarea',
    wide: true,
    placeholder: 'Prefer product companies; avoid agencies; English-speaking teams are a plus.',
  },
];

/** Compact rendering of an entry in its section list. */
export interface EntrySummary {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly meta?: string | undefined;
  readonly body?: string | undefined;
  readonly tags?: readonly string[] | undefined;
}

export interface SectionDescriptor<S extends ProfileSection> {
  readonly section: S;
  readonly title: string;
  readonly description: string;
  readonly noun: string;
  /** `chips` suits many small entries (skills, languages); `list` suits rich ones. */
  readonly layout: 'list' | 'chips';
  readonly fields: FieldsFor<SectionInput<S>>;
  readonly summarize: (data: SectionData<S>) => EntrySummary;
}

const join = (separator: string, ...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(separator) || undefined;

const highlights = {
  name: 'highlights',
  label: 'Highlights',
  kind: 'lines',
  wide: true,
  hint: 'One achievement per line. Quantify where you can.',
} as const;
const technologies = {
  name: 'technologies',
  label: 'Technologies',
  kind: 'tags',
  wide: true,
  placeholder: 'TypeScript, PostgreSQL, AWS',
} as const;
const summary = { name: 'summary', label: 'Summary', kind: 'textarea', wide: true } as const;
const startDate = { name: 'startDate', label: 'Start', kind: 'month' } as const;
const endDate = { name: 'endDate', label: 'End', kind: 'month' } as const;

type SectionDescriptors = { readonly [S in ProfileSection]: SectionDescriptor<S> };

export const sectionDescriptors: SectionDescriptors = {
  experience: {
    section: 'experience',
    title: 'Experience',
    description: 'Every role you have held. The agent picks and rewrites the relevant ones.',
    noun: 'experience',
    layout: 'list',
    fields: [
      { name: 'title', label: 'Job title', kind: 'text', required: true },
      { name: 'company', label: 'Company', kind: 'text', required: true },
      { ...startDate, required: true },
      { ...endDate, hint: 'Leave empty if this is your current role.' },
      { name: 'location', label: 'Location', kind: 'text' },
      {
        name: 'employmentType',
        label: 'Employment type',
        kind: 'select',
        options: employmentTypes,
      },
      { name: 'workplaceType', label: 'Workplace', kind: 'select', options: workplaceTypes },
      summary,
      highlights,
      technologies,
    ],
    summarize: (d) => ({
      title: d.title,
      subtitle: join(' · ', d.company, d.location),
      meta: formatPeriod(d.startDate, d.endDate, true),
      body: d.summary,
      tags: d.technologies,
    }),
  },
  education: {
    section: 'education',
    title: 'Education',
    description: 'Degrees, technical courses and bootcamps.',
    noun: 'education',
    layout: 'list',
    fields: [
      { name: 'institution', label: 'Institution', kind: 'text', required: true },
      { name: 'degree', label: 'Degree', kind: 'text', required: true, placeholder: 'BSc' },
      { name: 'field', label: 'Field of study', kind: 'text', placeholder: 'Computer Science' },
      { name: 'grade', label: 'Grade', kind: 'text' },
      startDate,
      endDate,
      summary,
      highlights,
    ],
    summarize: (d) => ({
      title: join(' in ', d.degree, d.field) ?? d.degree,
      subtitle: d.institution,
      meta: formatPeriod(d.startDate, d.endDate),
      body: d.summary,
    }),
  },
  certification: {
    section: 'certification',
    title: 'Certifications',
    description: 'Professional certificates and licences.',
    noun: 'certification',
    layout: 'list',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true },
      { name: 'issuer', label: 'Issuer', kind: 'text', required: true },
      { name: 'issueDate', label: 'Issued', kind: 'month' },
      { name: 'expirationDate', label: 'Expires', kind: 'month' },
      { name: 'credentialId', label: 'Credential ID', kind: 'text' },
      { name: 'url', label: 'Credential URL', kind: 'url' },
    ],
    summarize: (d) => ({
      title: d.name,
      subtitle: d.issuer,
      meta: d.issueDate && formatYearMonth(d.issueDate),
    }),
  },
  project: {
    section: 'project',
    title: 'Projects',
    description: 'Side projects, open source and notable work outside a job.',
    noun: 'project',
    layout: 'list',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true },
      { name: 'role', label: 'Your role', kind: 'text' },
      { name: 'url', label: 'URL', kind: 'url' },
      { name: 'repositoryUrl', label: 'Repository', kind: 'url' },
      startDate,
      endDate,
      summary,
      highlights,
      technologies,
    ],
    summarize: (d) => ({
      title: d.name,
      subtitle: d.role,
      meta: formatPeriod(d.startDate, d.endDate),
      body: d.summary,
      tags: d.technologies,
    }),
  },
  skill: {
    section: 'skill',
    title: 'Skills',
    description: 'Everything you can work with. Only these may appear on tailored résumés.',
    noun: 'skill',
    layout: 'chips',
    fields: [
      { name: 'name', label: 'Skill', kind: 'text', required: true },
      {
        name: 'category',
        label: 'Category',
        kind: 'select',
        required: true,
        options: toOptions(SKILL_CATEGORIES, { devops: 'DevOps', soft: 'Soft skill' }),
      },
      { name: 'level', label: 'Level', kind: 'select', options: toOptions(SKILL_LEVELS) },
      { name: 'years', label: 'Years of experience', kind: 'number' },
    ],
    summarize: (d) => ({ title: d.name, subtitle: d.category, meta: d.level }),
  },
  language: {
    section: 'language',
    title: 'Languages',
    description: 'Spoken languages and proficiency (CEFR).',
    noun: 'language',
    layout: 'chips',
    fields: [
      { name: 'name', label: 'Language', kind: 'text', required: true },
      {
        name: 'proficiency',
        label: 'Proficiency',
        kind: 'select',
        required: true,
        options: toOptions(LANGUAGE_PROFICIENCIES),
      },
    ],
    summarize: (d) => ({ title: d.name, meta: d.proficiency }),
  },
  award: {
    section: 'award',
    title: 'Awards',
    description: 'Prizes, honours and recognitions.',
    noun: 'award',
    layout: 'list',
    fields: [
      { name: 'title', label: 'Title', kind: 'text', required: true },
      { name: 'issuer', label: 'Issuer', kind: 'text' },
      { name: 'date', label: 'Date', kind: 'month' },
      summary,
    ],
    summarize: (d) => ({
      title: d.title,
      subtitle: d.issuer,
      meta: d.date && formatYearMonth(d.date),
      body: d.summary,
    }),
  },
  publication: {
    section: 'publication',
    title: 'Publications & talks',
    description: 'Articles, papers and conference talks.',
    noun: 'publication',
    layout: 'list',
    fields: [
      { name: 'title', label: 'Title', kind: 'text', required: true, wide: true },
      { name: 'publisher', label: 'Publisher / event', kind: 'text' },
      { name: 'date', label: 'Date', kind: 'month' },
      { name: 'url', label: 'URL', kind: 'url', wide: true },
      summary,
    ],
    summarize: (d) => ({
      title: d.title,
      subtitle: d.publisher,
      meta: d.date && formatYearMonth(d.date),
      body: d.summary,
    }),
  },
  volunteering: {
    section: 'volunteering',
    title: 'Volunteering',
    description: 'Community work, mentoring and non-profit roles.',
    noun: 'volunteering role',
    layout: 'list',
    fields: [
      { name: 'role', label: 'Role', kind: 'text', required: true },
      { name: 'organization', label: 'Organization', kind: 'text', required: true },
      startDate,
      endDate,
      summary,
      highlights,
    ],
    summarize: (d) => ({
      title: d.role,
      subtitle: d.organization,
      meta: formatPeriod(d.startDate, d.endDate),
      body: d.summary,
    }),
  },
};

/**
 * Descriptor for a section chosen at runtime. Each descriptor is typed for its own section; the
 * widening is safe because callers only ever pair it with entries of that same section.
 */
export function getSectionDescriptor(section: ProfileSection): SectionDescriptor<ProfileSection> {
  return sectionDescriptors[section];
}
