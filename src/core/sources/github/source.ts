import { z } from 'zod';

import { detectLanguage } from '@/core/shared/text';

import { createCatalogSource } from '../catalog';
import { API_USER_AGENT, createHttpClient, SourceUnavailableError, type HttpClient } from '../http';
import { employmentTypeFrom, isoDate, summarize, workplaceTypeFrom } from '../normalize';
import type { JobDetails, JobSource } from '../types';

/*
 * Brazilian community job boards that live in GitHub issues, labelled by stack, seniority and
 * contract (e.g. "PHP", "Sênior", "Remoto", "PJ"). Read through the public GitHub API.
 */
const REPOSITORIES = ['backend-br/vagas', 'frontendbr/vagas'] as const;

const issuesSchema = z.array(
  z.object({
    number: z.number(),
    title: z.string(),
    html_url: z.string(),
    created_at: z.string().nullish(),
    body: z.string().nullish(),
    labels: z.array(z.object({ name: z.string() })).nullish(),
    pull_request: z.unknown().optional(),
  }),
);

const SENIORITY = /^(j[uú]nior|pleno|s[eê]nior|especialista|est[aá]gio|lead|staff)$/i;

/** "[Remoto] Desenvolvedor PHP na Acme | 40h" → { role, company } */
export function splitTitle(title: string): { role: string; company?: string } {
  const clean = title.replace(/^(\s*\[[^\]]*\]\s*)+/, '').trim();
  const [head = clean] = clean.split(/\s+[|–—]\s+/);
  const match = /^(.*?)\s+(?:na|no|em|at|@)\s+(.+)$/i.exec(head);
  return match?.[1] && match[2] ? { role: match[1], company: match[2] } : { role: head };
}

export function parseIssues(repository: string, body: unknown): JobDetails[] {
  const parsed = issuesSchema.safeParse(body);
  if (!parsed.success) throw new SourceUnavailableError('GitHub changed its API format.');

  return parsed.data.flatMap((issue) => {
    if (issue.pull_request) return [];
    const labels = (issue.labels ?? []).map((label) => label.name);
    const { role, company } = splitTitle(issue.title);
    const tags = labels.join(', ');
    const description = summarize(tags && `Labels: ${tags}`) + `\n\n${issue.body ?? ''}`;
    return {
      externalId: `${repository}#${issue.number}`,
      url: issue.html_url,
      title: role,
      company: company ?? 'Not stated',
      location: labels.find((label) => /remoto|h[ií]brido|presencial/i.test(label)),
      workplaceType: workplaceTypeFrom(`${labels.join(' ')} ${issue.title}`),
      employmentType: labels.includes('PJ')
        ? 'contract'
        : employmentTypeFrom(labels.find((l) => /clt|full/i.test(l)) && 'full-time'),
      seniority: labels.find((label) => SENIORITY.test(label)),
      postedAt: isoDate(issue.created_at),
      language: detectLanguage(description),
      description: description.trim(),
    };
  });
}

export function createGitHubSource(
  http: HttpClient = createHttpClient({ minIntervalMs: 1_000, userAgent: API_USER_AGENT }),
): JobSource {
  return createCatalogSource({
    id: 'github',
    jobUrl: (id) => {
      const [repository, number] = id.split('#');
      return `https://github.com/${repository ?? ''}/issues/${number ?? ''}`;
    },
    // Unauthenticated GitHub API calls are limited to 60 an hour: fetch rarely.
    ttlMs: 60 * 60_000,
    fetch: async () => {
      const lists = await Promise.all(
        REPOSITORIES.map(async (repository) =>
          parseIssues(
            repository,
            await http.getJson(
              `https://api.github.com/repos/${repository}/issues?state=open&per_page=100`,
            ),
          ),
        ),
      );
      return lists.flat();
    },
  });
}
