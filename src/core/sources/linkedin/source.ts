import { NotFoundError } from '@/core/shared/errors';
import type { WorkplaceType } from '@/core/shared/schemas';

import { createHttpClient, type HttpClient } from '../http';
import type {
  ExperienceLevel,
  JobDetails,
  JobListing,
  JobSearchQuery,
  JobSource,
  PostedWithin,
} from '../types';
import { linkedInJobUrl, parseJobDetails, parseSearchResults } from './parse';

const BASE_URL = 'https://www.linkedin.com/jobs-guest/jobs/api';
const PAGE_SIZE = 10;
const MAX_PAGES = 5;

/** LinkedIn's query-string codes for its search filters. */
const FILTER_CODES = {
  workplace: { onsite: '1', remote: '2', hybrid: '3' } satisfies Record<WorkplaceType, string>,
  experience: {
    internship: '1',
    entry: '2',
    associate: '3',
    'mid-senior': '4',
    director: '5',
    executive: '6',
  } satisfies Record<ExperienceLevel, string>,
  postedWithin: {
    day: 'r86400',
    week: 'r604800',
    month: 'r2592000',
  } satisfies Record<PostedWithin, string>,
};

export function buildSearchUrl(query: JobSearchQuery, start: number): string {
  const params = new URLSearchParams({ keywords: query.keywords, start: String(start) });
  if (query.location) params.set('location', query.location);
  if (query.workplaceTypes?.length) {
    params.set('f_WT', query.workplaceTypes.map((type) => FILTER_CODES.workplace[type]).join(','));
  }
  if (query.experienceLevels?.length) {
    params.set(
      'f_E',
      query.experienceLevels.map((level) => FILTER_CODES.experience[level]).join(','),
    );
  }
  if (query.postedWithin) params.set('f_TPR', FILTER_CODES.postedWithin[query.postedWithin]);
  return `${BASE_URL}/seeMoreJobPostings/search?${params.toString()}`;
}

/**
 * Reads LinkedIn's public job pages, the same ones served to logged-out visitors. No account or
 * cookies are involved; requests are throttled to roughly one per second.
 */
export function createLinkedInSource(
  http: HttpClient = createHttpClient({ minIntervalMs: 1_200 }),
): JobSource {
  return {
    id: 'linkedin',
    jobUrl: linkedInJobUrl,

    async search(query) {
      const listings = new Map<string, JobListing>();
      // With a single workplace filter every result is known to share it; LinkedIn cards don't say.
      const workplaceType =
        query.workplaceTypes?.length === 1 ? query.workplaceTypes[0] : undefined;

      for (let page = 0; page < MAX_PAGES && listings.size < query.limit; page++) {
        const html = await http.getText(buildSearchUrl(query, page * PAGE_SIZE));
        const results = html ? parseSearchResults(html) : [];
        for (const listing of results) {
          if (!listings.has(listing.externalId)) {
            listings.set(listing.externalId, { ...listing, workplaceType });
          }
        }
        if (results.length < PAGE_SIZE) break;
      }

      return [...listings.values()].slice(0, query.limit);
    },

    async getDetails(externalId): Promise<JobDetails> {
      if (!/^\d+$/.test(externalId)) throw new NotFoundError('LinkedIn job', externalId);
      const html = await http.getText(`${BASE_URL}/jobPosting/${externalId}`);
      const details = html ? parseJobDetails(html, externalId) : null;
      if (!details) throw new NotFoundError('LinkedIn job', externalId);
      return details;
    },
  };
}
