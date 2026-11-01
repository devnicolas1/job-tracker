import { z } from 'zod';

import { detectLanguage, htmlToText } from '@/core/shared/text';

import { createCatalogSource } from '../catalog';
import { API_USER_AGENT, createHttpClient, SourceUnavailableError, type HttpClient } from '../http';
import { isoDate, summarize, workplaceTypeFrom } from '../normalize';
import type { JobDetails, JobSource } from '../types';

/*
 * Remotar's public API (the one remotar.com.br uses): Brazilian remote and hybrid jobs, newest
 * first. `search` matches titles and descriptions; the first page (50 jobs) is plenty per query.
 */
const searchUrl = (keywords: string) =>
  `https://api.remotar.com.br/jobs?${new URLSearchParams({ search: keywords }).toString()}`;

const responseSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      subtitle: z.string().nullish(),
      description: z.string().nullish(),
      city: z.string().nullish(),
      state: z.string().nullish(),
      type: z.string().nullish(),
      expired: z.boolean().nullish(),
      createdAt: z.string().nullish(),
      company: z.object({ name: z.string() }).nullish(),
      jobSalary: z
        .object({
          from: z.number().nullish(),
          to: z.number().nullish(),
          currency: z.string().nullish(),
          type: z.string().nullish(),
        })
        .nullish(),
      jobTags: z.array(z.object({ tag: z.object({ name: z.string() }) })).nullish(),
      jobRequirements: z
        .array(z.object({ description: z.string(), mandatory: z.boolean().nullish() }))
        .nullish(),
    }),
  ),
});

type RemotarJob = z.infer<typeof responseSchema>['data'][number];

/** Tags come with an emoji ("🧓🏽 Sênior"); keep the words. */
const tagsOf = (job: RemotarJob) =>
  (job.jobTags ?? []).map(({ tag }) => tag.name.replace(/^[^\p{L}\p{N}]+/u, '').trim());

/** Amounts are in cents; "uninformed" and "toMatch" (negotiable) carry no figure. */
function salaryOf(job: RemotarJob) {
  const salary = job.jobSalary;
  if (!salary?.from && !salary?.to) return undefined;
  const cents = [salary.from, salary.to].filter((amount): amount is number => Boolean(amount));
  const amounts = [...new Set(cents.map((amount) => amount / 100))];
  return summarize(salary.currency, amounts.join('–'), salary.type);
}

function seniorityOf(tags: string[]) {
  const levels = tags.filter((tag) => /^(júnior|pleno|sênior|especialista)$/i.test(tag));
  return levels.length ? levels.join(', ') : undefined;
}

function employmentTypeOf(tags: string[]) {
  if (tags.includes('CLT')) return 'full-time';
  if (tags.includes('PJ')) return 'contract';
  if (tags.includes('Freelancer')) return 'freelance';
  return undefined;
}

function requirementsOf(job: RemotarJob) {
  const list = (mandatory: boolean) =>
    (job.jobRequirements ?? [])
      .filter((requirement) => Boolean(requirement.mandatory) === mandatory)
      .map((requirement) => `- ${requirement.description}`)
      .join('\n');
  const required = list(true);
  const desired = list(false);
  return [required && `Requisitos:\n${required}`, desired && `Diferenciais:\n${desired}`].filter(
    Boolean,
  );
}

export function parseRemotar(body: unknown): JobDetails[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new SourceUnavailableError('Remotar changed its API format.');

  return parsed.data.data
    .filter((job) => !job.expired)
    .map((job) => {
      const tags = tagsOf(job);
      const description = [
        tags.length ? `Tags: ${tags.join(', ')}` : '',
        job.subtitle ?? '',
        htmlToText(job.description ?? ''),
        ...requirementsOf(job),
      ]
        .filter(Boolean)
        .join('\n\n');
      return {
        externalId: String(job.id),
        url: `https://remotar.com.br/job/${String(job.id)}`,
        title: job.title,
        company: job.company?.name.trim() ?? 'Unknown',
        // Remotar hires people living in Brazil, international companies included.
        location: [job.city, job.state, 'Brazil'].filter(Boolean).join(', '),
        salary: salaryOf(job),
        // Dates are Brazilian local time: keep that day rather than converting to UTC.
        postedAt: isoDate(job.createdAt?.slice(0, 10)),
        workplaceType: workplaceTypeFrom(job.type),
        employmentType: employmentTypeOf(tags),
        seniority: seniorityOf(tags),
        language: detectLanguage(description),
        description,
      };
    });
}

export function createRemotarSource(
  http: HttpClient = createHttpClient({ minIntervalMs: 1_000, userAgent: API_USER_AGENT }),
): JobSource {
  return createCatalogSource({
    id: 'remotar',
    jobUrl: (id) => `https://remotar.com.br/job/${id}`,
    fetch: async (query) => parseRemotar(await http.getJson(searchUrl(query.keywords))),
    cacheKey: (query) => query.keywords.toLowerCase(),
  });
}
