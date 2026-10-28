import { describe, expect, it } from 'vitest';

import { createCatalogSource, keywordsOf, matchesQuery } from './catalog';
import type { JobDetails } from './types';

const now = new Date('2026-10-27T12:00:00Z');
const posting = (overrides: Partial<JobDetails>): JobDetails => ({
  externalId: '1',
  url: 'https://jobs.test/1',
  title: 'Senior Laravel Developer',
  company: 'Acme',
  description: 'PHP 8, Laravel, Vue.js and PostgreSQL.',
  postedAt: '2026-10-25',
  location: 'Worldwide',
  workplaceType: 'remote',
  ...overrides,
});

describe('keywordsOf', () => {
  it('drops generic role words', () => {
    expect(keywordsOf('Senior PHP Laravel Developer')).toEqual(['php', 'laravel']);
  });
});

describe('matchesQuery', () => {
  const base = { keywords: 'laravel vue', limit: 10 };

  it('requires every meaningful keyword', () => {
    expect(matchesQuery(posting({}), base, now)).toBe(true);
    expect(matchesQuery(posting({}), { ...base, keywords: 'laravel react' }, now)).toBe(false);
  });

  it('filters by age, workplace and location', () => {
    expect(
      matchesQuery(posting({ postedAt: '2026-09-01' }), { ...base, postedWithin: 'week' }, now),
    ).toBe(false);
    expect(matchesQuery(posting({}), { ...base, workplaceTypes: ['onsite'] }, now)).toBe(false);
    expect(
      matchesQuery(posting({ location: 'USA only' }), { ...base, location: 'Brazil' }, now),
    ).toBe(false);
    expect(matchesQuery(posting({ location: 'LATAM' }), { ...base, location: 'Brazil' }, now)).toBe(
      true,
    );
  });

  it('counts a posting dated exactly the window ago', () => {
    const week = { ...base, postedWithin: 'week' as const };
    expect(matchesQuery(posting({ postedAt: '2026-10-20' }), week, now)).toBe(true);
    expect(matchesQuery(posting({ postedAt: '2026-10-19' }), week, now)).toBe(false);
  });

  it('recognises country codes and local names', () => {
    const inBrazil = { ...base, location: 'Brazil' };
    expect(matchesQuery(posting({ location: 'BR' }), inBrazil, now)).toBe(true);
    expect(matchesQuery(posting({ location: 'São Paulo, SP, Brasil' }), inBrazil, now)).toBe(true);
    expect(matchesQuery(posting({ location: 'Brooklyn, NY' }), inBrazil, now)).toBe(false);
    expect(
      matchesQuery(posting({ location: 'Remote - US' }), { ...base, location: 'USA' }, now),
    ).toBe(true);
  });
});

describe('createCatalogSource', () => {
  it('downloads once per cache window and serves details from memory', async () => {
    let downloads = 0;
    const source = createCatalogSource({
      id: 'test',
      jobUrl: (id) => `https://jobs.test/${id}`,
      fetch: () => {
        downloads++;
        return Promise.resolve([
          posting({}),
          posting({ externalId: '2', title: 'Go Engineer', description: 'Go' }),
        ]);
      },
      now: () => now,
    });

    expect(await source.search({ keywords: 'laravel', limit: 5 })).toHaveLength(1);
    expect(await source.search({ keywords: 'go', limit: 5 })).toHaveLength(1);
    expect(downloads).toBe(1);
    expect((await source.getDetails('2')).title).toBe('Go Engineer');
    await expect(source.getDetails('404')).rejects.toThrow('search test first');
  });
});
