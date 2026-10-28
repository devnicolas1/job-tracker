import { z } from 'zod';

import { detectLanguage, htmlToText } from '@/core/shared/text';

import { createCatalogSource } from '../catalog';
import { API_USER_AGENT, createHttpClient, SourceUnavailableError, type HttpClient } from '../http';
import { employmentTypeFrom, isoDate, summarize } from '../normalize';
import type { JobDetails, JobSource } from '../types';

/** Himalayas' public search API: remote jobs with salary, seniority and eligible countries. */
const searchUrl = (keywords: string) =>
  `https://himalayas.app/jobs/api/search?${new URLSearchParams({ q: keywords, limit: '20' }).toString()}`;

const responseSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      companyName: z.string(),
      employmentType: z.string().nullish(),
      minSalary: z.number().nullish(),
      maxSalary: z.number().nullish(),
      currency: z.string().nullish(),
      salaryPeriod: z.string().nullish(),
      seniority: z.array(z.string()).nullish(),
      locationRestrictions: z.array(z.string()).nullish(),
      description: z.string().nullish(),
      pubDate: z.number().nullish(),
      applicationLink: z.string(),
      guid: z.string(),
    }),
  ),
});

function salaryOf(job: z.infer<typeof responseSchema>['jobs'][number]) {
  if (!job.minSalary && !job.maxSalary) return undefined;
  const range = [job.minSalary, job.maxSalary].filter(Boolean).join('–');
  return summarize(job.currency, range, job.salaryPeriod);
}

export function parseHimalayas(body: unknown): JobDetails[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new SourceUnavailableError('Himalayas changed its API format.');

  return parsed.data.jobs.map((job) => {
    const countries = job.locationRestrictions ?? [];
    const description = summarize(
      job.seniority?.length ? `Seniority: ${job.seniority.join(', ')}` : undefined,
      countries.length ? `Eligible: ${countries.join(', ')}` : 'Eligible: worldwide',
    );
    const body = htmlToText(job.description ?? '');
    return {
      externalId: job.guid.split('/').filter(Boolean).at(-1) ?? job.guid,
      url: job.applicationLink,
      title: job.title,
      company: job.companyName,
      location: countries.length ? countries.join(', ') : 'Worldwide',
      salary: salaryOf(job),
      postedAt: isoDate(job.pubDate),
      workplaceType: 'remote',
      employmentType: employmentTypeFrom(job.employmentType),
      seniority: job.seniority?.join(', '),
      language: detectLanguage(body),
      description: `${description}\n\n${body}`,
    };
  });
}

export function createHimalayasSource(
  http: HttpClient = createHttpClient({ minIntervalMs: 1_000, userAgent: API_USER_AGENT }),
): JobSource {
  return createCatalogSource({
    id: 'himalayas',
    jobUrl: (id) => `https://himalayas.app/jobs?q=${encodeURIComponent(id)}`,
    fetch: async (query) => parseHimalayas(await http.getJson(searchUrl(query.keywords))),
    cacheKey: (query) => query.keywords.toLowerCase(),
  });
}
