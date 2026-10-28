import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { AppConfig } from '@/core/config';
import type { Services } from '@/core/container';
import {
  jobAssessmentSchema,
  jobPostingSchema,
  jobSourceSchema,
  jobStatusSchema,
} from '@/core/jobs/schemas';
import { ValidationError } from '@/core/shared/errors';
import { workplaceTypeSchema } from '@/core/shared/schemas';
import { truncate } from '@/core/shared/text';
import { SourceUnavailableError } from '@/core/sources/http';
import { getJobSource, JOB_SOURCE_IDS, type JobSourceId } from '@/core/sources/registry';
import { EXPERIENCE_LEVELS, POSTED_WITHIN, type JobListing } from '@/core/sources/types';
import { resumeTailoringInputSchema } from '@/core/tailoring/schemas';

import { formatJob, formatJobDetails, formatJobSummary, formatListing } from '../format';
import type { JobCache } from '../job-cache';
import { toPatchSchema } from '../schemas';
import { registerTool } from '../tool';

const sourceIdSchema = z.enum(JOB_SOURCE_IDS).default('linkedin');
const isKnownSource = (source: string): source is JobSourceId =>
  (JOB_SOURCE_IDS as readonly string[]).includes(source);

interface Dependencies {
  readonly services: Services;
  readonly cache: JobCache;
  readonly config: Pick<AppConfig, 'webUrl'>;
}

export function registerJobTools(server: McpServer, { services, cache, config }: Dependencies) {
  const { jobs, profiles } = services;
  const jobLink = (id: string) => `${config.webUrl}/jobs/${id}`;

  /** Posting data seen earlier this session, fetching the full posting only if it wasn't opened. */
  async function resolvePosting(source: JobSourceId, externalId: string) {
    const cached = cache.get(source, externalId);
    if (cached?.description !== undefined) return cached;
    cache.remember(source, await getJobSource(source).getDetails(externalId));
    return cache.get(source, externalId) ?? {};
  }

  registerTool(server, {
    name: 'search_jobs',
    title: 'Search jobs',
    description:
      'Runs searches on job boards (all of them unless `sources` is given) and returns one line ' +
      'per new posting, grouped by source: `externalId | title | company | location | posted | ' +
      'salary`. Already tracked or dismissed postings and duplicates are skipped. Pass the ' +
      "group's source to get_job_posting / save_job / dismiss_jobs.",
    input: z.object({
      queries: z
        .array(
          z.object({
            keywords: z.string().trim().min(2).max(120),
            location: z.string().trim().max(120).optional(),
          }),
        )
        .min(1)
        .max(6),
      sources: z.array(z.enum(JOB_SOURCE_IDS)).min(1).optional(),
      workplaceTypes: z.array(workplaceTypeSchema).optional(),
      experienceLevels: z.array(z.enum(EXPERIENCE_LEVELS)).optional(),
      postedWithin: z.enum(POSTED_WITHIN).default('week'),
      limitPerQuery: z.int().min(1).max(50).default(15),
      includeKnown: z.boolean().default(false),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    run: async ({ queries, sources = JOB_SOURCE_IDS, includeKnown, limitPerQuery, ...filters }) => {
      const targets = profiles.getProfile().preferences.companyBoards;
      const blocks: string[] = [];
      const empty: string[] = [];

      for (const sourceId of sources) {
        const source = getJobSource(sourceId);
        const seen = new Set<string>();
        const lines: string[] = [];
        let skipped = 0;

        for (const { keywords, location } of queries) {
          let listings: JobListing[];
          try {
            listings = await source.search({
              keywords,
              location,
              limit: limitPerQuery,
              targets,
              ...filters,
            });
          } catch (error) {
            if (!(error instanceof SourceUnavailableError)) throw error;
            lines.push(`(stopped: ${error.message})`);
            break;
          }

          const known = includeKnown
            ? new Set<string>()
            : jobs.findKnownExternalIds(
                sourceId,
                listings.map((listing) => listing.externalId),
              );
          for (const listing of listings) {
            if (known.has(listing.externalId) || seen.has(listing.externalId)) {
              skipped += Number(known.has(listing.externalId));
              continue;
            }
            seen.add(listing.externalId);
            cache.remember(sourceId, listing);
            lines.push(formatListing(listing));
          }
        }

        if (lines.length === 0) empty.push(sourceId);
        else
          blocks.push(
            [`## ${sourceId}: ${seen.size} new, ${skipped} skipped`, ...lines].join('\n'),
          );
      }

      if (empty.length) blocks.push(`No new matches: ${empty.join(', ')}`);
      return blocks.join('\n\n');
    },
  });

  registerTool(server, {
    name: 'get_job_posting',
    title: 'Get job posting',
    description:
      'Full posting (criteria + plain-text description) from a job board. Only open postings ' +
      'that look promising from their search line. Flags excluded keywords from preferences.',
    input: z.object({
      externalId: z.string().min(1),
      source: sourceIdSchema,
      maxChars: z.int().min(500).max(20_000).default(5_000),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    run: async ({ externalId, source: sourceId, maxChars }) => {
      const details = await getJobSource(sourceId).getDetails(externalId);
      cache.remember(sourceId, details);

      const haystack = `${details.title}\n${details.description}`.toLowerCase();
      const excluded = profiles
        .getProfile()
        .preferences.excludeKeywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
      const warning = excluded.length
        ? `⚠ mentions excluded keywords: ${excluded.join(', ')}\n`
        : '';
      return warning + formatJobDetails(details, truncate(details.description, maxChars));
    },
  });

  registerTool(server, {
    name: 'save_job',
    title: 'Save job',
    description:
      'Adds (or refreshes) a job in the tracker with your fit assessment and, for strong ' +
      'matches, a tailored résumé: edits to the base résumé from get_base_resume. For ' +
      'job-board sources the posting is filled in server-side, so send only ids + your ' +
      'analysis. For other sources pass `posting` with at least url, title and company.',
    input: z.object({
      source: jobSourceSchema.default('linkedin'),
      externalId: z.string().min(1),
      posting: toPatchSchema(jobPostingSchema.omit({ source: true, externalId: true })).optional(),
      assessment: jobAssessmentSchema,
      tailoredResume: resumeTailoringInputSchema.optional(),
      status: jobStatusSchema.optional(),
    }),
    run: async ({ source, externalId, posting, ...rest }) => {
      const fetched = isKnownSource(source) ? await resolvePosting(source, externalId) : {};
      const { job, created } = await jobs.save({
        ...fetched,
        ...posting,
        ...rest,
        source,
        externalId,
      });
      return `${created ? 'Saved' : 'Updated'} [${job.id}] ${job.title} — ${job.company}: ${jobLink(job.id)}`;
    },
  });

  registerTool(server, {
    name: 'dismiss_jobs',
    title: 'Dismiss jobs',
    description:
      'Records postings you reviewed and rejected so future searches skip them. Postings seen ' +
      'via search_jobs need only externalId (+ a short reason).',
    input: z.object({
      source: sourceIdSchema,
      items: z
        .array(
          z.object({
            externalId: z.string().min(1),
            reason: z.string().trim().max(200).optional(),
            title: z.string().optional(),
            company: z.string().optional(),
          }),
        )
        .min(1)
        .max(100),
    }),
    run: ({ source: sourceId, items }) => {
      const source = getJobSource(sourceId);
      const postings = items.map(({ externalId, reason, title, company }) => {
        const cached = cache.get(sourceId, externalId);
        const resolvedTitle = cached?.title ?? title;
        const resolvedCompany = cached?.company ?? company;
        if (!resolvedTitle || !resolvedCompany) {
          throw new ValidationError(`Unknown posting ${externalId}: pass its title and company.`);
        }
        return {
          source: sourceId,
          externalId,
          url: source.jobUrl(externalId),
          title: resolvedTitle,
          company: resolvedCompany,
          reason,
        };
      });
      return `Dismissed ${jobs.dismiss(postings)} posting(s).`;
    },
  });

  registerTool(server, {
    name: 'list_jobs',
    title: 'List tracked jobs',
    description:
      'Tracked jobs, best match first: `[id] score | title | company | location | status | ' +
      'posted | résumé`. Dismissed jobs are hidden unless requested by status.',
    input: z.object({
      statuses: z.array(jobStatusSchema).optional(),
      minScore: z.int().min(0).max(100).optional(),
      query: z.string().max(200).optional(),
      limit: z.int().min(1).max(200).default(30),
    }),
    annotations: { readOnlyHint: true },
    run: (filter) => {
      const results = jobs.list(filter);
      return results.length ? results.map(formatJobSummary).join('\n') : 'No jobs match.';
    },
  });

  registerTool(server, {
    name: 'get_job',
    title: 'Get tracked job',
    description:
      'A tracked job: assessment, notes, current tailored résumé (as JSON) and the posting text.',
    input: z.object({ id: z.string(), maxChars: z.int().min(0).max(20_000).default(4_000) }),
    annotations: { readOnlyHint: true },
    run: ({ id, maxChars }) => {
      const job = jobs.get(id);
      const description =
        job.description && maxChars > 0 ? truncate(job.description, maxChars) : undefined;
      return formatJob(job, jobLink(id), description);
    },
  });

  registerTool(server, {
    name: 'save_tailored_resume',
    title: 'Save tailored résumé',
    description:
      "Attaches (or replaces) a tracked job's tailored résumé: edits to the base résumé from " +
      'get_base_resume, as in save_job. For jobs already in the tracker.',
    input: z.object({ id: z.string(), tailoredResume: resumeTailoringInputSchema }),
    run: async ({ id, tailoredResume }) => {
      const job = await jobs.setTailoredResume(id, tailoredResume);
      return `Saved résumé for [${job.id}] ${job.title} — ${job.company}: ${jobLink(job.id)}`;
    },
  });

  registerTool(server, {
    name: 'update_job',
    title: 'Update tracked job',
    description:
      "Changes a tracked job's status or notes. To replace its résumé, call save_job again.",
    input: z.object({
      id: z.string(),
      status: jobStatusSchema.optional(),
      notes: z.string().max(10_000).optional(),
    }),
    run: ({ id, status, notes }) => {
      if (status) jobs.updateStatus(id, status);
      if (notes !== undefined) jobs.updateNotes(id, notes);
      return `Updated [${id}]: ${jobLink(id)}`;
    },
  });
}
