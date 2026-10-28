import * as cheerio from 'cheerio';
import { z } from 'zod';

import { detectLanguage, htmlToText } from '@/core/shared/text';

import { employmentTypeFrom, isoDate, workplaceTypeFrom } from '../normalize';
import type { JobDetails } from '../types';

/*
 * Parsers for the public job-board APIs of the three applicant-tracking systems most startups
 * use. Ids are prefixed with provider and board so they stay unique across companies.
 */

export const PROVIDERS = ['greenhouse', 'lever', 'ashby', 'inhire'] as const;
export type Provider = (typeof PROVIDERS)[number];

/** "plaid-technologies" → "Plaid Technologies" (Lever and Ashby give no company name). */
const titleCase = (slug: string) =>
  slug.replace(/[-_]+/g, ' ').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

const posting = (fields: Omit<JobDetails, 'language'>): JobDetails => ({
  ...fields,
  language: detectLanguage(fields.description),
});

const greenhouseSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      absolute_url: z.string(),
      company_name: z.string().nullish(),
      location: z.object({ name: z.string() }).nullish(),
      first_published: z.string().nullish(),
      updated_at: z.string().nullish(),
      content: z.string().nullish(),
    }),
  ),
});

export function parseGreenhouse(board: string, body: unknown): JobDetails[] {
  return greenhouseSchema.parse(body).jobs.map((job) =>
    posting({
      externalId: `greenhouse:${board}:${job.id}`,
      url: job.absolute_url,
      title: job.title,
      company: job.company_name ?? titleCase(board),
      location: job.location?.name,
      workplaceType: workplaceTypeFrom(job.location?.name),
      postedAt: isoDate(job.first_published ?? job.updated_at),
      // Greenhouse escapes its HTML: decode the entities first, then convert to text.
      description: htmlToText(cheerio.load(job.content ?? '').text()),
    }),
  );
}

const leverSchema = z.array(
  z.object({
    id: z.string(),
    text: z.string(),
    hostedUrl: z.string(),
    createdAt: z.number().nullish(),
    workplaceType: z.string().nullish(),
    categories: z
      .object({ location: z.string().nullish(), commitment: z.string().nullish() })
      .nullish(),
    descriptionPlain: z.string().nullish(),
    lists: z.array(z.object({ text: z.string(), content: z.string() })).nullish(),
    additionalPlain: z.string().nullish(),
  }),
);

export function parseLever(board: string, body: unknown): JobDetails[] {
  return leverSchema.parse(body).map((job) =>
    posting({
      externalId: `lever:${board}:${job.id}`,
      url: job.hostedUrl,
      title: job.text,
      company: titleCase(board),
      location: job.categories?.location ?? undefined,
      workplaceType: workplaceTypeFrom(job.workplaceType ?? job.categories?.location),
      employmentType: employmentTypeFrom(job.categories?.commitment),
      postedAt: isoDate(job.createdAt ? job.createdAt / 1000 : undefined),
      description: [
        job.descriptionPlain,
        ...(job.lists ?? []).map((list) => `${list.text}\n${htmlToText(list.content)}`),
        job.additionalPlain,
      ]
        .filter(Boolean)
        .join('\n\n'),
    }),
  );
}

const ashbySchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      jobUrl: z.string(),
      location: z.string().nullish(),
      secondaryLocations: z.array(z.object({ location: z.string() })).nullish(),
      isRemote: z.boolean().nullish(),
      workplaceType: z.string().nullish(),
      employmentType: z.string().nullish(),
      publishedAt: z.string().nullish(),
      isListed: z.boolean().nullish(),
      descriptionPlain: z.string().nullish(),
    }),
  ),
});

export function parseAshby(board: string, body: unknown): JobDetails[] {
  return ashbySchema
    .parse(body)
    .jobs.filter((job) => job.isListed !== false)
    .map((job) => {
      const locations = [job.location, ...(job.secondaryLocations ?? []).map((l) => l.location)];
      return posting({
        externalId: `ashby:${board}:${job.id}`,
        url: job.jobUrl,
        title: job.title.trim(),
        company: titleCase(board),
        location: locations.filter(Boolean).join(', ') || undefined,
        workplaceType: job.isRemote ? 'remote' : workplaceTypeFrom(job.workplaceType),
        employmentType: employmentTypeFrom(job.employmentType?.replace(/([a-z])([A-Z])/g, '$1 $2')),
        postedAt: isoDate(job.publishedAt),
        description: job.descriptionPlain ?? '',
      });
    });
}

const inhireListSchema = z.object({
  jobsPage: z.array(z.object({ jobId: z.string(), status: z.string().nullish() })),
});

/** Ids of the published jobs on an InHire career page (the list carries no descriptions). */
export const parseInHireList = (body: unknown) =>
  inhireListSchema
    .parse(body)
    .jobsPage.filter((job) => job.status === 'published')
    .map((job) => job.jobId);

const inhireJobSchema = z.object({
  jobId: z.string(),
  displayName: z.string(),
  tenantName: z.string().nullish(),
  description: z.string().nullish(),
  workplaceType: z.string().nullish(),
  location: z.string().nullish(),
  locationComplement: z.string().nullish(),
  contractType: z.array(z.string()).nullish(),
  publishedAt: z.string().nullish(),
});

/** One InHire job; `board` is "tenant/careerPage", e.g. "magazineluiza/magalucloud". */
export function parseInHireJob(board: string, body: unknown): JobDetails {
  const job = inhireJobSchema.parse(body);
  const [tenant = '', careerPage = ''] = board.split('/');
  const contracts = job.contractType ?? [];
  return posting({
    externalId: `inhire:${board}:${job.jobId}`,
    url: `https://${tenant}.inhire.app/${careerPage}/vagas/${job.jobId}`,
    title: job.displayName,
    company: job.tenantName ?? titleCase(careerPage),
    location: [job.location, job.locationComplement].filter(Boolean).join(', ') || undefined,
    workplaceType: workplaceTypeFrom(job.workplaceType),
    // Brazilian contracts: CLT is employment, PJ is contracting.
    employmentType: contracts.includes('CLT')
      ? 'full-time'
      : contracts.includes('PJ')
        ? 'contract'
        : employmentTypeFrom(contracts[0]),
    postedAt: isoDate(job.publishedAt),
    description: [
      contracts.length ? `Contract: ${contracts.join(', ')}` : '',
      htmlToText(job.description ?? ''),
    ]
      .filter(Boolean)
      .join('\n\n'),
  });
}
