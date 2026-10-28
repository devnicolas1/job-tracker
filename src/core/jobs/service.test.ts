import { beforeEach, describe, expect, it } from 'vitest';

import type { Services } from '@/core/container';
import { ValidationError } from '@/core/shared/errors';
import { NotFoundError } from '@/core/shared/errors';
import { createTestServices, samplePosting, seedBaseResume } from '@/core/testing/fixtures';

describe('job service', () => {
  let services: Services;
  beforeEach(() => {
    services = createTestServices();
  });

  it('upserts by source and external id, keeping the user status', async () => {
    const { jobs } = services;
    const { job, created } = await jobs.save(samplePosting);
    jobs.updateStatus(job.id, 'applied');

    const again = await jobs.save({
      ...samplePosting,
      title: 'Senior TypeScript Engineer (Remote)',
      assessment: { matchScore: 87, matchSummary: 'Strong fit.' },
    });

    expect(created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.job).toMatchObject({
      id: job.id,
      status: 'applied',
      title: 'Senior TypeScript Engineer (Remote)',
    });
    expect(jobs.list()[0]?.assessment?.matchScore).toBe(87);
  });

  it('lists by score and hides dismissed postings by default', async () => {
    const { jobs } = services;
    await jobs.save({
      ...samplePosting,
      externalId: 'a',
      assessment: { matchScore: 60, matchSummary: 'Ok.' },
    });
    await jobs.save({
      ...samplePosting,
      externalId: 'b',
      assessment: { matchScore: 90, matchSummary: 'Great.' },
    });
    await jobs.save({ ...samplePosting, externalId: 'c' });
    jobs.dismiss([{ ...samplePosting, externalId: 'd', reason: 'Requires relocation' }]);

    expect(jobs.list().map((job) => job.externalId)).toEqual(['b', 'a', 'c']);
    expect(jobs.list({ minScore: 70 }).map((job) => job.externalId)).toEqual(['b']);
    expect(jobs.list({ statuses: ['dismissed'] })[0]?.notes).toContain('Requires relocation');
    expect(jobs.findKnownExternalIds('linkedin', ['a', 'd', 'z'])).toEqual(new Set(['a', 'd']));
  });

  it('searches title and company case-insensitively, treating wildcards literally', async () => {
    const { jobs } = services;
    await jobs.save({ ...samplePosting, externalId: 'a', company: 'Globex' });
    await jobs.save({ ...samplePosting, externalId: 'b', title: '100% Remote Dev' });

    expect(jobs.list({ query: 'GLOBEX' }).map((job) => job.externalId)).toEqual(['a']);
    expect(jobs.list({ query: '100%' }).map((job) => job.externalId)).toEqual(['b']);
  });

  it('tailors the base résumé with paragraph edits pinned to its version', async () => {
    const { jobs, tailoredResumes } = services;
    const tailoredResume = {
      language: 'en',
      edits: [{ op: 'replace', id: 'p5', text: '**CI/CD:** standardised GitLab pipelines.' }],
    } as const;

    await expect(jobs.save({ ...samplePosting, tailoredResume })).rejects.toThrow(NotFoundError);
    await seedBaseResume(services);
    await expect(
      jobs.save({
        ...samplePosting,
        tailoredResume: { ...tailoredResume, edits: [{ op: 'delete', id: 'p99' }] },
      }),
    ).rejects.toThrow(ValidationError);

    const { job } = await jobs.save({ ...samplePosting, tailoredResume });
    expect(jobs.list()[0]?.hasTailoredResume).toBe(true);
    const stored = jobs.get(job.id).tailoredResume!;
    expect(await tailoredResumes.status(stored)).toBe('ready');

    const { fileName, pdf } = await tailoredResumes.render(stored, job.company);
    expect(fileName).toBe('Ana Souza CV en - Acme.pdf');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');

    // Replacing the base résumé invalidates paragraph ids written against the old one.
    await services.resumes.upload({
      language: 'en',
      fileName: 'new.pdf',
      bytes: new Uint8Array(await tailoredResumes.render(stored, 'x').then((r) => r.pdf)),
    });
    expect(await tailoredResumes.status(stored)).toBe('base-changed');
  });
});
