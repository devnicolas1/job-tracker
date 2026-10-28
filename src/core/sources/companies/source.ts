import { createCatalogSource } from '../catalog';
import { API_USER_AGENT, createHttpClient, SourceUnavailableError, type HttpClient } from '../http';
import type { JobDetails, JobSource } from '../types';
import {
  parseAshby,
  parseGreenhouse,
  parseInHireJob,
  parseInHireList,
  parseLever,
  PROVIDERS,
  type Provider,
} from './parse';

/*
 * Company career pages hosted on Greenhouse, Lever or Ashby, read through their public job-board
 * APIs. Which companies to watch comes from the job preferences ("greenhouse:stripe"…), passed in
 * as search targets.
 */

/** At most this many jobs are read per InHire board, which needs one request per job. */
const INHIRE_MAX_JOBS = 60;

interface Board {
  readonly page: (board: string, id: string) => string;
  /** Downloads a board's postings, or `null` when the board does not exist. */
  readonly fetch: (http: HttpClient, board: string) => Promise<JobDetails[] | null>;
}

const fromApi =
  (api: (board: string) => string, parse: (board: string, body: unknown) => JobDetails[]) =>
  async (http: HttpClient, board: string) => {
    const body = await http.getJson(api(board));
    return body === null ? null : parse(board, body);
  };

const BOARDS: Readonly<Record<Provider, Board>> = {
  greenhouse: {
    page: (board, id) => `https://job-boards.greenhouse.io/${board}/jobs/${id}`,
    fetch: fromApi(
      (board) => `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`,
      parseGreenhouse,
    ),
  },
  lever: {
    page: (board, id) => `https://jobs.lever.co/${board}/${id}`,
    fetch: fromApi((board) => `https://api.lever.co/v0/postings/${board}?mode=json`, parseLever),
  },
  ashby: {
    page: (board, id) => `https://jobs.ashbyhq.com/${board}/${id}`,
    fetch: fromApi((board) => `https://api.ashbyhq.com/posting-api/job-board/${board}`, parseAshby),
  },
  // InHire (Brazilian ATS): public career-page API, scoped by an X-Tenant header.
  inhire: {
    page: (board, id) => {
      const [tenant = '', careerPage = ''] = board.split('/');
      return `https://${tenant}.inhire.app/${careerPage}/vagas/${id}`;
    },
    fetch: async (http, board) => {
      const [tenant = '', careerPage = ''] = board.split('/');
      const options = { headers: { 'X-Tenant': tenant } };
      const api = 'https://api.inhire.app/job-posts/public/pages';
      const list = await http.getJson(`${api}/careerPage/${careerPage}`, options);
      if (list === null) return null;
      const postings: JobDetails[] = [];
      for (const jobId of parseInHireList(list).slice(0, INHIRE_MAX_JOBS)) {
        const job = await http.getJson(`${api}/${jobId}`, options);
        if (job !== null) postings.push(parseInHireJob(board, job));
      }
      return postings;
    },
  },
};

/** Board names per provider: InHire boards are "tenant/careerPage". */
const BOARD_PATTERN: Readonly<Record<Provider, RegExp>> = {
  greenhouse: /^[\w.-]+$/,
  lever: /^[\w.-]+$/,
  ashby: /^[\w.-]+$/,
  inhire: /^[\w.-]+\/[\w.-]+$/,
};

/** "greenhouse:stripe" → ["greenhouse", "stripe"], or null when malformed. */
export function parseTarget(target: string): [Provider, string] | null {
  const separator = target.indexOf(':');
  const provider = target.slice(0, separator).toLowerCase();
  const board = target.slice(separator + 1).toLowerCase();
  if (!(PROVIDERS as readonly string[]).includes(provider)) return null;
  return BOARD_PATTERN[provider as Provider].test(board) ? [provider as Provider, board] : null;
}

export function createCompaniesSource(
  http: HttpClient = createHttpClient({ minIntervalMs: 500, userAgent: API_USER_AGENT }),
): JobSource {
  return createCatalogSource({
    id: 'companies',
    jobUrl: (externalId) => {
      const [provider = '', board, ...id] = externalId.split(':');
      const config = (BOARDS as Partial<Record<string, Board>>)[provider];
      return config && board ? config.page(board, id.join(':')) : '';
    },
    cacheKey: (query) => [...(query.targets ?? [])].sort().join(','),
    ttlMs: 60 * 60_000,
    fetch: async ({ targets = [] }) => {
      const postings: JobDetails[] = [];
      for (const target of targets) {
        const parsed = parseTarget(target);
        if (!parsed) continue;
        const [provider, board] = parsed;
        let boardPostings: JobDetails[] | null;
        try {
          boardPostings = await BOARDS[provider].fetch(http, board);
        } catch (error) {
          if (error instanceof SourceUnavailableError) throw error;
          throw new SourceUnavailableError(`${provider} changed its API format (${board}).`);
        }
        // An unknown board has nothing to read.
        postings.push(...(boardPostings ?? []));
      }
      return postings;
    },
  });
}
