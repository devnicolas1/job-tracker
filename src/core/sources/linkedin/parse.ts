import * as cheerio from 'cheerio';

import type { EmploymentType } from '@/core/shared/schemas';
import { detectLanguage, htmlToText, squish } from '@/core/shared/text';

import type { JobDetails, JobListing } from '../types';

/*
 * Parsers for LinkedIn's public ("guest") job pages. They are pure functions over HTML so they can
 * be unit-tested against fixtures; when LinkedIn changes its markup, only this file changes.
 */

const JOB_URN = /urn:li:jobPosting:(\d+)/;

export const linkedInJobUrl = (externalId: string) =>
  `https://www.linkedin.com/jobs/view/${externalId}/`;

/** Structural view of a cheerio selection, to avoid depending on its internal node types. */
interface Selection {
  first(): { text(): string };
}

const textOf = (selection: Selection) => squish(selection.first().text()) || undefined;

export function parseSearchResults(html: string): JobListing[] {
  const $ = cheerio.load(html);

  return $('[data-entity-urn*="jobPosting"]')
    .toArray()
    .flatMap((card) => {
      const $card = $(card);
      const externalId = JOB_URN.exec($card.attr('data-entity-urn') ?? '')?.[1];
      const title = textOf($card.find('.base-search-card__title'));
      const company = textOf($card.find('.base-search-card__subtitle'));
      if (!externalId || !title || !company) return [];

      return {
        externalId,
        url: linkedInJobUrl(externalId),
        title,
        company,
        location: textOf($card.find('.job-search-card__location')),
        postedAt: $card.find('time[datetime]').attr('datetime'),
        salary: textOf($card.find('.job-search-card__salary-info')),
      } satisfies JobListing;
    });
}

const EMPLOYMENT_TYPES: Readonly<Record<string, EmploymentType>> = {
  'full-time': 'full-time',
  'part-time': 'part-time',
  contract: 'contract',
  temporary: 'temporary',
  internship: 'internship',
};

export function parseJobDetails(html: string, externalId: string): JobDetails | null {
  const $ = cheerio.load(html);
  const pick = (selector: string) => textOf($(selector));

  const title = pick('.topcard__title');
  const company = pick('.topcard__org-name-link') ?? pick('.topcard__flavor');
  if (!title || !company) return null;

  const criteria = new Map(
    $('.description__job-criteria-item')
      .toArray()
      .map((item) => [
        squish($(item).find('.description__job-criteria-subheader').text()).toLowerCase(),
        squish($(item).find('.description__job-criteria-text').text()),
      ]),
  );

  const descriptionHtml = $('.show-more-less-html__markup').first().html() ?? '';
  const description = htmlToText(descriptionHtml);

  return {
    externalId,
    url: linkedInJobUrl(externalId),
    title,
    company,
    location: pick('.topcard__flavor--bullet'),
    salary: pick('.compensation__salary'),
    applicants: pick('.num-applicants__caption'),
    seniority: criteria.get('seniority level') || undefined,
    employmentType: EMPLOYMENT_TYPES[criteria.get('employment type')?.toLowerCase() ?? ''],
    language: detectLanguage(description),
    description,
  };
}
