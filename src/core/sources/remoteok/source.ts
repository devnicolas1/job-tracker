import { z } from 'zod';

import { detectLanguage, htmlToText } from '@/core/shared/text';

import { createCatalogSource } from '../catalog';
import { API_USER_AGENT, createHttpClient, SourceUnavailableError, type HttpClient } from '../http';
import { isoDate } from '../normalize';
import type { JobDetails, JobSource } from '../types';

/*
 * Remote OK's public API: one JSON array of recent remote jobs (its first element is a legal
 * notice). Terms: link back to Remote OK, which the stored URLs do.
 */
const API_URL = 'https://remoteok.com/api';

const jobSchema = z.object({
  id: z.union([z.string(), z.number()]),
  position: z.string(),
  company: z.string(),
  url: z.string(),
  date: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  location: z.string().nullish(),
  salary_min: z.number().nullish(),
  salary_max: z.number().nullish(),
  description: z.string().nullish(),
});

export function parseRemoteOk(body: unknown): JobDetails[] {
  if (!Array.isArray(body)) throw new SourceUnavailableError('Remote OK changed its API format.');

  return body.flatMap((item) => {
    const parsed = jobSchema.safeParse(item);
    if (!parsed.success) return []; // the legal notice, or a malformed entry
    const job = parsed.data;
    const description = [
      job.tags?.length ? `Tags: ${job.tags.join(', ')}` : '',
      htmlToText(job.description ?? ''),
    ]
      .filter(Boolean)
      .join('\n\n');
    return {
      externalId: String(job.id),
      url: job.url,
      title: job.position,
      company: job.company,
      location: job.location || 'Worldwide',
      salary: job.salary_max ? `USD ${job.salary_min ?? 0}–${job.salary_max}` : undefined,
      postedAt: isoDate(job.date),
      workplaceType: 'remote' as const,
      language: detectLanguage(description),
      description,
    };
  });
}

export function createRemoteOkSource(
  http: HttpClient = createHttpClient({ minIntervalMs: 1_000, userAgent: API_USER_AGENT }),
): JobSource {
  return createCatalogSource({
    id: 'remoteok',
    jobUrl: (id) => `https://remoteok.com/remote-jobs/${id}`,
    fetch: async () => parseRemoteOk(await http.getJson(API_URL)),
    ttlMs: 60 * 60_000,
  });
}
