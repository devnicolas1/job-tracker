import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Services } from '@/core/container';
import {
  createTestServices,
  samplePosting,
  seedBaseResume,
  seedProfile,
} from '@/core/testing/fixtures';

import { createMcpServer } from './create-server';

async function connect(services: Services) {
  const server = createMcpServer(services, { webUrl: 'http://app.test' });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const [content] = result.content as { type: 'text'; text: string }[];
    return { text: content?.text ?? '', isError: result.isError === true };
  };
}

describe('MCP server', () => {
  let services: Services;
  let call: Awaited<ReturnType<typeof connect>>;

  beforeEach(async () => {
    services = createTestServices();
    call = await connect(services);
  });

  it('renders the profile compactly with entry ids', async () => {
    const { current } = seedProfile(services);
    const { text } = await call('get_profile');

    expect(text).toContain('# Ana Souza');
    expect(text).toContain(`[${current.id}] Senior Software Engineer @ Globex (2022-03→now)`);
    expect(text).toContain('  - Led the payments rewrite');
  });

  it('patches preferences without resetting omitted fields', async () => {
    await call('update_job_preferences', { patch: { targetRoles: ['Backend Engineer'] } });
    await call('update_job_preferences', { patch: { locations: ['Brazil'] } });

    expect(services.profiles.getProfile().preferences).toMatchObject({
      targetRoles: ['Backend Engineer'],
      locations: ['Brazil'],
    });
  });

  it('reports validation problems as tool errors the agent can act on', async () => {
    const result = await call('save_profile_entry', {
      section: 'experience',
      data: { company: 'Acme', title: 'Engineer', startDate: 'March 2020' },
    });

    expect(result.isError).toBe(true);
    expect(result.text).toContain('startDate');
  });

  it('saves jobs from other sources with an explicit posting and lists them', async () => {
    const saved = await call('save_job', {
      source: 'company-site',
      externalId: 'acme-42',
      posting: { url: 'https://acme.test/jobs/42', title: 'Platform Engineer', company: 'Acme' },
      assessment: { matchScore: 81, matchSummary: 'Good overlap with platform work.' },
    });
    expect(saved.text).toMatch(
      /^Saved \[[\w-]{11}\] Platform Engineer — Acme: http:\/\/app\.test\/jobs\//,
    );

    const { text } = await call('list_jobs');
    expect(text).toMatch(/\] 81 \| Platform Engineer \| Acme \| new$/);
  });

  it('tailors a tracked job on demand: get_job shows the posting, save_tailored_resume attaches edits', async () => {
    await seedBaseResume(services);
    const { job } = await services.jobs.save({
      ...samplePosting,
      description: 'We need PHP and Laravel.',
    });

    const details = await call('get_job', { id: job.id });
    expect(details.text).toContain('We need PHP and Laravel.');

    const saved = await call('save_tailored_resume', {
      id: job.id,
      tailoredResume: {
        language: 'en',
        edits: [{ op: 'replace', id: 'p5', text: '**CI/CD:** GitLab pipelines.' }],
      },
    });
    expect(saved.isError).toBe(false);
    expect(services.jobs.get(job.id).tailoredResume?.edits).toHaveLength(1);

    const invalid = await call('save_tailored_resume', {
      id: job.id,
      tailoredResume: { language: 'en', edits: [{ op: 'delete', id: 'p99' }] },
    });
    expect(invalid).toMatchObject({
      isError: true,
      text: expect.stringContaining('p99') as string,
    });
  });
});
