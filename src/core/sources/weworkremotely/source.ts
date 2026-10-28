import * as cheerio from 'cheerio';

import { detectLanguage, htmlToText } from '@/core/shared/text';

import { createCatalogSource } from '../catalog';
import { API_USER_AGENT, createHttpClient, type HttpClient } from '../http';
import { employmentTypeFrom, isoDate } from '../normalize';
import type { JobDetails, JobSource } from '../types';

/** We Work Remotely's RSS feeds for the categories that fit a software engineer. */
const FEEDS = [
  'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
];

export function parseWeWorkRemotelyFeed(xml: string): JobDetails[] {
  const $ = cheerio.load(xml, { xml: true });
  return $('item')
    .toArray()
    .flatMap((item) => {
      const field = (name: string) => $(item).find(name).first().text().trim() || undefined;
      const url = field('link');
      const heading = field('title');
      if (!url || !heading) return [];
      // Titles read "Company: Position".
      const separator = heading.indexOf(': ');
      const [company, title] =
        separator > 0 ? [heading.slice(0, separator), heading.slice(separator + 2)] : ['', heading];
      if (!company) return [];

      const description = htmlToText(field('description') ?? '');
      return {
        externalId: url.split('/').filter(Boolean).at(-1) ?? url,
        url,
        title,
        company,
        location: field('region'),
        postedAt: isoDate(field('pubDate')),
        workplaceType: 'remote' as const,
        employmentType: employmentTypeFrom(field('type')),
        language: detectLanguage(description),
        description,
      };
    });
}

export function createWeWorkRemotelySource(
  http: HttpClient = createHttpClient({ minIntervalMs: 1_000, userAgent: API_USER_AGENT }),
): JobSource {
  return createCatalogSource({
    id: 'weworkremotely',
    jobUrl: (id) => `https://weworkremotely.com/remote-jobs/${id}`,
    fetch: async () => {
      const feeds = await Promise.all(FEEDS.map((feed) => http.getText(feed)));
      // A posting can be listed in both categories.
      const unique = new Map(
        feeds
          .flatMap((xml) => parseWeWorkRemotelyFeed(xml ?? ''))
          .map((job) => [job.externalId, job]),
      );
      return [...unique.values()];
    },
    ttlMs: 60 * 60_000,
  });
}
