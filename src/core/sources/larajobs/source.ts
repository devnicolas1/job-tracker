import * as cheerio from 'cheerio';

import { createCatalogSource } from '../catalog';
import { API_USER_AGENT, createHttpClient, type HttpClient } from '../http';
import { employmentTypeFrom, isoDate, summarize, workplaceTypeFrom } from '../normalize';
import type { JobDetails, JobSource } from '../types';

const FEED_URL = 'https://larajobs.com/feed';

/**
 * LaraJobs' RSS feed. Job links lead straight to each employer's application page, so the feed's
 * metadata (location, type, salary, tags) is all there is to read; it doubles as the description.
 */
export function parseLaraJobsFeed(xml: string): JobDetails[] {
  const $ = cheerio.load(xml, { xml: true });
  return $('item')
    .toArray()
    .flatMap((item) => {
      const field = (name: string) => $(item).find(name).first().text().trim() || undefined;
      const url = field('link');
      const id = url && /\/job\/(\d+)/.exec(url)?.[1];
      const title = field('title');
      const company = field('job\\:company') ?? field('dc\\:creator');
      if (!url || !id || !title || !company) return [];

      const location = field('job\\:location');
      const type = field('job\\:job_type');
      const salary = field('job\\:salary');
      const tags = field('job\\:tags');
      return {
        externalId: id,
        url,
        title,
        company,
        location,
        salary,
        postedAt: isoDate(field('pubDate')),
        workplaceType: workplaceTypeFrom(location),
        employmentType: employmentTypeFrom(type),
        language: 'en',
        description: summarize(tags && `Tags: ${tags}`, location, type, salary),
      } satisfies JobDetails;
    });
}

export function createLaraJobsSource(
  http: HttpClient = createHttpClient({ minIntervalMs: 1_000, userAgent: API_USER_AGENT }),
): JobSource {
  return createCatalogSource({
    id: 'larajobs',
    jobUrl: (id) => `https://larajobs.com/job/${id}`,
    fetch: async () => parseLaraJobsFeed((await http.getText(FEED_URL)) ?? ''),
  });
}
