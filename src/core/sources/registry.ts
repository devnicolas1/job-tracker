import { NotFoundError } from '@/core/shared/errors';

import { createCompaniesSource } from './companies/source';
import { createGitHubSource } from './github/source';
import { createHackerNewsSource } from './hackernews/source';
import { createHimalayasSource } from './himalayas/source';
import { createLaraJobsSource } from './larajobs/source';
import { createLinkedInSource } from './linkedin/source';
import { createRemoteOkSource } from './remoteok/source';
import { createRemotiveSource } from './remotive/source';
import type { JobSource } from './types';
import { createWeWorkRemotelySource } from './weworkremotely/source';

/** Every source the agent can search. Add new boards here. */
const factories = {
  linkedin: createLinkedInSource,
  larajobs: createLaraJobsSource,
  remotive: createRemotiveSource,
  himalayas: createHimalayasSource,
  remoteok: createRemoteOkSource,
  weworkremotely: createWeWorkRemotelySource,
  companies: createCompaniesSource,
  hackernews: createHackerNewsSource,
  github: createGitHubSource,
} satisfies Record<string, () => JobSource>;

export type JobSourceId = keyof typeof factories;
export const JOB_SOURCE_IDS = Object.keys(factories) as [JobSourceId, ...JobSourceId[]];

const instances = new Map<JobSourceId, JobSource>();

export function getJobSource(id: JobSourceId): JobSource {
  let source = instances.get(id);
  if (!source) {
    if (!(id in factories)) throw new NotFoundError('Job source', id);
    source = factories[id]();
    instances.set(id, source);
  }
  return source;
}
