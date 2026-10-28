import { z } from 'zod';

import { detectLanguage, htmlToText } from '@/core/shared/text';

import { createCatalogSource } from '../catalog';
import { API_USER_AGENT, createHttpClient, SourceUnavailableError, type HttpClient } from '../http';
import { employmentTypeFrom, isoDate } from '../normalize';
import type { JobDetails, JobSource } from '../types';

/*
 * Remotive's public API. Its terms: link back to Remotive (we keep its URLs and name it as the
 * source) and call it a few times a day at most, hence the long cache.
 */
const API_URL = 'https://remotive.com/api/remote-jobs?category=software-dev';

const responseSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.union([z.number(), z.string()]),
      url: z.string(),
      title: z.string(),
      company_name: z.string(),
      tags: z.array(z.string()).nullish(),
      job_type: z.string().nullish(),
      publication_date: z.string().nullish(),
      candidate_required_location: z.string().nullish(),
      salary: z.string().nullish(),
      description: z.string().nullish(),
    }),
  ),
});

export function parseRemotive(body: unknown): JobDetails[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new SourceUnavailableError('Remotive changed its API format.');

  return parsed.data.jobs.map((job) => {
    const description = [
      job.tags?.length ? `Tags: ${job.tags.join(', ')}` : '',
      htmlToText(job.description ?? ''),
    ]
      .filter(Boolean)
      .join('\n\n');
    return {
      externalId: String(job.id),
      url: job.url,
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location ?? undefined,
      salary: job.salary || undefined,
      postedAt: isoDate(job.publication_date),
      workplaceType: 'remote',
      employmentType: employmentTypeFrom(job.job_type),
      language: detectLanguage(description),
      description,
    };
  });
}

export function createRemotiveSource(
  http: HttpClient = createHttpClient({ minIntervalMs: 1_000, userAgent: API_USER_AGENT }),
): JobSource {
  return createCatalogSource({
    id: 'remotive',
    jobUrl: (id) => `https://remotive.com/remote-jobs/${id}`,
    fetch: async () => parseRemotive(await http.getJson(API_URL)),
    ttlMs: 6 * 60 * 60_000,
  });
}
