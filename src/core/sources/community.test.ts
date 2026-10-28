import { describe, expect, it } from 'vitest';

import { parseIssues, splitTitle } from './github/source';
import { parseWhoIsHiring } from './hackernews/source';
import { readFixture } from './testing';

const fixture = (source: string, name: string) =>
  JSON.parse(readFixture(new URL(`./${source}`, import.meta.url).pathname, name)) as unknown;

describe('HN Who is hiring', () => {
  it('reads top-level posts and skips replies', () => {
    const jobs = parseWhoIsHiring(fixture('hackernews', 'comments.json'));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: '49930001',
      company: 'Acme Corp',
      title: 'Senior Backend Engineer (PHP)',
      location: 'REMOTE (Americas) | $150k',
      workplaceType: 'remote',
      postedAt: '2026-10-02',
    });
  });
});

describe('GitHub job boards', () => {
  it('splits role and company out of issue titles', () => {
    expect(splitTitle('[Remoto] [PJ] Desenvolvedor PHP na Acme | 40h')).toEqual({
      role: 'Desenvolvedor PHP',
      company: 'Acme',
    });
    expect(splitTitle('Backend Developer')).toEqual({ role: 'Backend Developer' });
  });

  it('maps labels and skips pull requests', () => {
    const jobs = parseIssues('backend-br/vagas', fixture('github', 'issues.json'));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: 'backend-br/vagas#12486',
      company: 'WeatherWise',
      location: 'Remoto',
      workplaceType: 'remote',
      employmentType: 'contract',
      seniority: 'Sênior',
      language: 'pt',
    });
  });
});
