import { describe, expect, it } from 'vitest';

import { parseHimalayas } from './himalayas/source';
import { parseLaraJobsFeed } from './larajobs/source';
import { parseRemoteOk } from './remoteok/source';
import { parseRemotive } from './remotive/source';
import { readFixture } from './testing';
import { parseWeWorkRemotelyFeed } from './weworkremotely/source';

const dir = (source: string) => new URL(`./${source}`, import.meta.url).pathname;

describe('LaraJobs feed', () => {
  it('turns items into postings and skips incomplete ones', () => {
    expect(parseLaraJobsFeed(readFixture(dir('larajobs'), 'feed.xml'))).toEqual([
      {
        externalId: '3949',
        url: 'https://larajobs.com/job/3949',
        title: 'Senior Full Stack Engineer (PHP/Laravel)',
        company: 'Evolution Collect, LLC',
        location: 'Remote/USA',
        salary: '$160,000.00 - $180,000.00',
        postedAt: '2026-10-25',
        workplaceType: 'remote',
        employmentType: 'full-time',
        language: 'en',
        description:
          'Tags: Full Time,Laravel,MySQL,VueJS · Remote/USA · FULL_TIME · $160,000.00 - $180,000.00',
      },
    ]);
  });
});

describe('Remotive API', () => {
  it('maps jobs and converts descriptions to text', () => {
    const [job] = parseRemotive(JSON.parse(readFixture(dir('remotive'), 'jobs.json')));
    expect(job).toMatchObject({
      externalId: '2091161',
      company: 'Acme',
      location: 'Worldwide',
      postedAt: '2026-10-22',
      workplaceType: 'remote',
      employmentType: 'full-time',
      language: 'en',
    });
    expect(job?.description).toContain('Tags: php, laravel');
    expect(job?.description).toContain('- PHP 8');
  });

  it('reports a changed format instead of returning garbage', () => {
    expect(() => parseRemotive({ items: [] })).toThrow('changed its API format');
  });
});

describe('Himalayas API', () => {
  it('maps salary, seniority and eligible countries', () => {
    const [job] = parseHimalayas(JSON.parse(readFixture(dir('himalayas'), 'search.json')));
    expect(job).toMatchObject({
      externalId: 'senior-laravel-developer-123',
      location: 'Brazil, Argentina',
      salary: 'USD · 60000–80000 · annual',
      seniority: 'Senior',
      employmentType: 'full-time',
      postedAt: '2026-10-15',
    });
    expect(job?.description).toContain('Eligible: Brazil, Argentina');
  });
});

describe('Remote OK API', () => {
  it('skips the legal notice and maps jobs', () => {
    const jobs = parseRemoteOk(JSON.parse(readFixture(dir('remoteok'), 'api.json')));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: '1137556',
      title: 'Backend Engineer',
      location: 'Worldwide',
      salary: 'USD 50000–90000',
      postedAt: '2026-10-22',
    });
  });
});

describe('We Work Remotely feed', () => {
  it('splits "Company: Position" titles', () => {
    expect(
      parseWeWorkRemotelyFeed(readFixture(dir('weworkremotely'), 'feed.xml'))[0],
    ).toMatchObject({
      externalId: 'duckduckgo-senior-backend-engineer',
      company: 'DuckDuckGo',
      title: 'Senior Backend Engineer',
      location: 'Anywhere in the World',
      employmentType: 'full-time',
      postedAt: '2026-10-20',
    });
  });
});
