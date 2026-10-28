import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import type { HttpClient } from '../http';
import { parseJobDetails, parseSearchResults } from './parse';
import { buildSearchUrl, createLinkedInSource } from './source';

const fixture = (name: string) =>
  fs.readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');

describe('parseSearchResults', () => {
  it('extracts listings and skips incomplete cards', () => {
    const listings = parseSearchResults(fixture('search-results.html'));

    expect(listings).toEqual([
      {
        externalId: '4000000001',
        url: 'https://www.linkedin.com/jobs/view/4000000001/',
        title: 'Senior TypeScript Engineer',
        company: 'Acme & Co',
        location: 'São Paulo, Brazil',
        postedAt: '2026-10-21',
        salary: 'R$15,000 - R$20,000',
      },
      {
        externalId: '4000000002',
        url: 'https://www.linkedin.com/jobs/view/4000000002/',
        title: 'Desenvolvedor Backend Node.js',
        company: 'Globex',
        location: 'Remote',
        postedAt: undefined,
        salary: undefined,
      },
    ]);
  });

  it('returns an empty list for unrelated markup', () => {
    expect(parseSearchResults('<html><body>Sign in</body></html>')).toEqual([]);
  });
});

describe('parseJobDetails', () => {
  it('extracts criteria and converts the description to plain text', () => {
    const details = parseJobDetails(fixture('job-posting.html'), '4000000002');

    expect(details).toMatchObject({
      title: 'Desenvolvedor Backend Node.js',
      company: 'Globex',
      location: 'São Paulo, São Paulo, Brazil',
      applicants: 'Be among the first 25 applicants',
      seniority: 'Mid-Senior level',
      employmentType: 'full-time',
      language: 'pt',
    });
    expect(details?.description).toContain('- Desenvolver APIs com Node.js e TypeScript\n');
    expect(details?.description).not.toMatch(/<|\n{3}/);
  });

  it('returns null when the page is not a job posting', () => {
    expect(parseJobDetails('<p>Not found</p>', '1')).toBeNull();
  });
});

describe('buildSearchUrl', () => {
  it('encodes filters using LinkedIn codes', () => {
    const url = new URL(
      buildSearchUrl(
        {
          keywords: 'react developer',
          location: 'Brazil',
          workplaceTypes: ['remote', 'hybrid'],
          experienceLevels: ['mid-senior'],
          postedWithin: 'week',
          limit: 10,
        },
        20,
      ),
    );

    expect(Object.fromEntries(url.searchParams)).toEqual({
      keywords: 'react developer',
      location: 'Brazil',
      start: '20',
      f_WT: '2,3',
      f_E: '4',
      f_TPR: 'r604800',
    });
  });
});

describe('createLinkedInSource', () => {
  it('stops paginating when a page is not full and tags the single workplace filter', async () => {
    const getText = vi
      .fn<HttpClient['getText']>()
      .mockResolvedValue(fixture('search-results.html'));
    const source = createLinkedInSource({ getText, getJson: vi.fn() });

    const listings = await source.search({
      keywords: 'node',
      workplaceTypes: ['remote'],
      limit: 25,
    });

    expect(getText).toHaveBeenCalledTimes(1);
    expect(listings).toHaveLength(2);
    expect(listings.every((listing) => listing.workplaceType === 'remote')).toBe(true);
  });

  it('rejects non-numeric ids without making a request', async () => {
    const getText = vi.fn<HttpClient['getText']>();
    await expect(
      createLinkedInSource({ getText, getJson: vi.fn() }).getDetails('../etc'),
    ).rejects.toThrow('not found');
    expect(getText).not.toHaveBeenCalled();
  });
});
