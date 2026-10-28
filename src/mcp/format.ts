import type { Job, JobSummary } from '@/core/jobs/schemas';
import type {
  JobPreferences,
  Profile,
  ProfileEntry,
  ProfileSection,
  SectionData,
} from '@/core/profile/schemas';
import type { JobDetails, JobListing } from '@/core/sources/types';

/*
 * Compact, line-oriented renderings for the agent. Plain text with ids in brackets costs a
 * fraction of the tokens of pretty-printed JSON and reads just as unambiguously.
 */

type Part = string | number | false | null | undefined;

/** Joins the parts that are present. */
const join = (separator: string, ...parts: Part[]) =>
  parts
    .filter((part) => part !== undefined && part !== null && part !== false && part !== '')
    .join(separator);

const period = (start?: string, end?: string, ongoing = false) =>
  start || end ? `(${start ?? '?'}→${end ?? (ongoing ? 'now' : '?')})` : undefined;

const list = (items: readonly string[] | undefined) =>
  items?.length ? items.join(', ') : undefined;

/** One header line per entry, specialised by section. */
const headers: { [S in ProfileSection]: (data: SectionData<S>) => string } = {
  experience: (d) =>
    join(
      ' · ',
      `${d.title} @ ${d.company} ${period(d.startDate, d.endDate, true) ?? ''}`.trim(),
      d.location,
      d.employmentType,
      d.workplaceType,
    ),
  education: (d) =>
    join(
      ' · ',
      join(
        ' ',
        d.degree,
        d.field && `in ${d.field}`,
        `@ ${d.institution}`,
        period(d.startDate, d.endDate),
      ),
      d.grade,
    ),
  certification: (d) =>
    join(
      ' · ',
      `${d.name} — ${d.issuer}`,
      d.issueDate,
      d.expirationDate && `expires ${d.expirationDate}`,
      d.credentialId,
      d.url,
    ),
  project: (d) =>
    join(' · ', join(' ', d.name, period(d.startDate, d.endDate)), d.role, d.url, d.repositoryUrl),
  skill: (d) => join(' · ', d.name, d.category, d.level, d.years !== undefined && `${d.years}y`),
  language: (d) => `${d.name} · ${d.proficiency}`,
  award: (d) => join(' · ', d.title, d.issuer, d.date),
  publication: (d) => join(' · ', d.title, d.publisher, d.date, d.url),
  volunteering: (d) => join(' ', `${d.role} @ ${d.organization}`, period(d.startDate, d.endDate)),
};

function formatEntry(entry: ProfileEntry): string {
  const header = (headers[entry.section] as (data: SectionData<ProfileSection>) => string)(
    entry.data,
  );
  const data = entry.data as Partial<
    Record<'summary', string> & Record<'highlights' | 'technologies', string[]>
  >;
  return [
    `[${entry.id}] ${header}`,
    data.summary && `  ${data.summary.replace(/\n+/g, ' ')}`,
    ...(data.highlights ?? []).map((highlight) => `  - ${highlight}`),
    data.technologies?.length && `  tech: ${data.technologies.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatPreferences(preferences: JobPreferences): string {
  return [
    ['target roles', list(preferences.targetRoles)],
    ['seniority', list(preferences.seniority)],
    ['workplace', list(preferences.workplaceTypes)],
    ['employment', list(preferences.employmentTypes)],
    ['locations', list(preferences.locations)],
    ['keywords', list(preferences.searchKeywords)],
    ['exclude', list(preferences.excludeKeywords)],
    ['salary', preferences.salaryExpectation],
    ['relocation', preferences.openToRelocation ? 'open' : undefined],
    ['notes', preferences.notes],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

export function formatProfile(profile: Profile, sections?: readonly ProfileSection[]): string {
  const { basics } = profile;
  const blocks: string[] = [];

  if (!sections) {
    blocks.push(
      basics
        ? [
            `# ${join(' — ', basics.fullName, basics.headline)}`,
            join(
              ' | ',
              basics.email,
              basics.phone,
              basics.location,
              basics.linkedin,
              basics.github,
              basics.website,
            ),
            basics.summary,
          ]
            .filter(Boolean)
            .join('\n')
        : '# (profile basics not filled in yet)',
      `## preferences\n${formatPreferences(profile.preferences) || '(none)'}`,
    );
  }

  for (const [section, entries] of Object.entries(profile.entries) as [
    ProfileSection,
    readonly ProfileEntry[],
  ][]) {
    if (sections && !sections.includes(section)) continue;
    if (entries.length === 0) continue;
    blocks.push(`## ${section}\n${entries.map(formatEntry).join('\n')}`);
  }
  return blocks.join('\n\n');
}

/** Long eligibility lists ("Albania, Andorra, …") would dominate the line: keep the start. */
const shorten = (value: string | undefined, max = 48) =>
  value && value.length > max ? `${value.slice(0, max).replace(/,?\s*\S*$/, '')}…` : value;

export const formatListing = (listing: JobListing) =>
  join(
    ' | ',
    listing.externalId,
    listing.title,
    listing.company,
    shorten(listing.location),
    listing.postedAt,
    listing.salary,
  );

export function formatJobDetails(details: JobDetails, description: string): string {
  return [
    `${details.title} — ${details.company}`,
    join(
      ' | ',
      details.location,
      details.workplaceType,
      details.employmentType,
      details.seniority,
      details.salary,
      details.applicants,
      details.language && `lang:${details.language}`,
    ),
    details.url,
    '',
    description,
  ].join('\n');
}

export const formatJobSummary = (job: JobSummary) =>
  join(
    ' | ',
    `[${job.id}] ${job.assessment ? String(job.assessment.matchScore) : '--'}`,
    job.title,
    job.company,
    job.location,
    job.status,
    job.postedAt,
    job.hasTailoredResume && 'résumé',
  );

/** A tracked job for the agent; `description` is the (possibly truncated) posting text. */
export function formatJob(job: Job, webUrl: string, description?: string): string {
  return [
    formatJobSummary({ ...job, hasTailoredResume: job.tailoredResume !== null }),
    join(
      ' | ',
      job.workplaceType,
      job.employmentType,
      job.seniority,
      job.salary,
      job.language && `lang:${job.language}`,
    ),
    `source: ${job.source}/${job.externalId} ${job.url}`,
    `app: ${webUrl}`,
    job.assessment && `fit: ${job.assessment.matchSummary}`,
    job.assessment?.strengths.length && `strengths: ${job.assessment.strengths.join('; ')}`,
    job.assessment?.gaps.length && `gaps: ${job.assessment.gaps.join('; ')}`,
    job.notes && `notes: ${job.notes}`,
    job.tailoredResume && `tailoredResume: ${JSON.stringify(job.tailoredResume)}`,
    description && `\n${description}`,
  ]
    .filter(Boolean)
    .join('\n');
}
