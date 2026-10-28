import { describe, expect, it } from 'vitest';

import { fakeHttp, readFixture } from '../testing';
import { parseAshby, parseGreenhouse, parseInHireJob, parseInHireList, parseLever } from './parse';
import { createCompaniesSource, parseTarget } from './source';

const fixture = (name: string) => JSON.parse(readFixture(import.meta.dirname, name)) as unknown;

describe('company board parsers', () => {
  it('reads Greenhouse, decoding its escaped HTML', () => {
    expect(parseGreenhouse('gitlab', fixture('greenhouse.json'))[0]).toMatchObject({
      externalId: 'greenhouse:gitlab:8638232002',
      company: 'GitLab',
      location: 'Remote, Americas',
      workplaceType: 'remote',
      postedAt: '2026-07-22',
      description:
        'We are looking for an engineer with experience in Ruby and you will work with our team.',
    });
  });

  it('reads Lever, naming the company after the board', () => {
    const [job] = parseLever('spotify', fixture('lever.json'));
    expect(job).toMatchObject({
      externalId: 'lever:spotify:2a55d6c9',
      company: 'Spotify',
      workplaceType: 'hybrid',
    });
    expect(job?.description).toContain("What You'll Do\n- Ship APIs");
  });

  it('reads Ashby and skips unlisted postings', () => {
    const jobs = parseAshby('ramp', fixture('ashby.json'));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: 'Software Engineer, Backend',
      location: 'New York, NY (HQ), Remote (Canada)',
      workplaceType: 'remote',
      employmentType: 'full-time',
    });
  });
});

describe('companies source', () => {
  it('reads every configured board and ignores malformed or unknown ones', async () => {
    const http = fakeHttp({
      'boards/gitlab': readFixture(import.meta.dirname, 'greenhouse.json'),
      'postings/spotify': readFixture(import.meta.dirname, 'lever.json'),
    });
    const source = createCompaniesSource(http);

    const jobs = await source.search({
      keywords: 'engineer',
      limit: 10,
      targets: ['greenhouse:gitlab', 'lever:spotify', 'ashby:nobody', 'not a target'],
    });

    expect(jobs.map((job) => job.company).sort()).toEqual(['GitLab', 'Spotify']);
    expect(http.urls).toHaveLength(3);
    expect(source.jobUrl('lever:spotify:2a55d6c9')).toBe('https://jobs.lever.co/spotify/2a55d6c9');
    expect(parseTarget('Greenhouse:Stripe')).toEqual(['greenhouse', 'stripe']);
  });
});

describe('InHire boards', () => {
  it('lists published jobs and reads one with its contract type', () => {
    expect(parseInHireList(fixture('inhire-list.json'))).toEqual(['c6f11c5b']);
    expect(parseInHireJob('magazineluiza/magalucloud', fixture('inhire-job.json'))).toMatchObject({
      externalId: 'inhire:magazineluiza/magalucloud:c6f11c5b',
      url: 'https://magazineluiza.inhire.app/magalucloud/vagas/c6f11c5b',
      company: 'Magalu Cloud',
      location: 'BR',
      workplaceType: 'remote',
      employmentType: 'full-time',
      postedAt: '2026-10-15',
      language: 'pt',
    });
  });

  it('accepts tenant/careerPage targets and sends the tenant header', async () => {
    expect(parseTarget('inhire:magazineluiza/magalucloud')).toEqual([
      'inhire',
      'magazineluiza/magalucloud',
    ]);
    expect(parseTarget('inhire:magalucloud')).toBeNull();

    const headers: (Readonly<Record<string, string>> | undefined)[] = [];
    const http = fakeHttp({
      'careerPage/magalucloud': readFixture(import.meta.dirname, 'inhire-list.json'),
      'pages/c6f11c5b': readFixture(import.meta.dirname, 'inhire-job.json'),
    });
    const source = createCompaniesSource({
      getText: (url) => http.getText(url),
      getJson: (url, options) => {
        headers.push(options?.headers);
        return http.getJson(url);
      },
    });

    const jobs = await source.search({
      keywords: 'python',
      limit: 5,
      targets: ['inhire:magazineluiza/magalucloud'],
    });
    expect(jobs.map((job) => job.title)).toEqual(['Desenvolvedor(a) Backend Sênior']);
    expect(headers.every((h) => h?.['X-Tenant'] === 'magazineluiza')).toBe(true);
  });
});
