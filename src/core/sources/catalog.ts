import { NotFoundError } from '@/core/shared/errors';

import type { JobDetails, JobSearchQuery, JobSource, PostedWithin } from './types';

/*
 * Sources whose feed or API returns full postings in one go (RSS boards, public job APIs).
 * The catalog fetches, caches for a while (several queries reuse one download), filters and
 * remembers postings so `getDetails` never needs another request.
 */

/** Role words that carry no signal when matching a posting against a query. */
const GENERIC_WORDS = new Set([
  'developer',
  'engineer',
  'software',
  'senior',
  'sr',
  'junior',
  'jr',
  'mid',
  'pleno',
  'lead',
  'remote',
  'remoto',
  'desenvolvedor',
  'desenvolvedora',
  'engenheiro',
  'engenheira',
  'de',
  'and',
  'the',
  'e',
  'pessoa',
  'dev',
  'programmer',
]);

/** Locations that accept candidates from anywhere, or from a broad region. */
const OPEN_LOCATIONS =
  /worldwide|anywhere|global|international|americas|latam|latin america|south america/i;

/** Country codes and local names boards use, mapped to the English name a query uses. */
const PLACE_ALIASES: Readonly<Record<string, string>> = {
  br: 'brazil',
  bra: 'brazil',
  brasil: 'brazil',
  us: 'united states',
  usa: 'united states',
  'united states of america': 'united states',
  uk: 'united kingdom',
  gb: 'united kingdom',
  'great britain': 'united kingdom',
  eu: 'european union',
};

const DAYS: Readonly<Record<PostedWithin, number>> = { day: 1, week: 7, month: 31 };
const DAY_MS = 86_400_000;

/** "São Paulo, SP, BR" → the places it names, each also under its canonical name. */
function placesOf(location: string): Set<string> {
  const parts = location.toLowerCase().split(/[^\p{L}\s]+/u);
  const places = new Set<string>();
  for (const part of [...parts, ...parts.flatMap((p) => p.split(/\s+/))]) {
    const place = part.trim();
    if (place) places.add(PLACE_ALIASES[place] ?? place);
  }
  return places;
}

function locationMatches(postingLocation: string, wantedLocation: string): boolean {
  const location = postingLocation.toLowerCase();
  const wanted = wantedLocation.toLowerCase().trim();
  if (location.includes(wanted) || OPEN_LOCATIONS.test(location)) return true;
  return placesOf(postingLocation).has(PLACE_ALIASES[wanted] ?? wanted);
}

export function keywordsOf(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#.]+/u)
    .filter((word) => word.length > 1 && !GENERIC_WORDS.has(word));
}

/** Whether a posting satisfies a query: every meaningful keyword, date and place filter. */
export function matchesQuery(
  posting: JobDetails,
  query: JobSearchQuery,
  now = new Date(),
): boolean {
  const haystack = `${posting.title} ${posting.company} ${posting.description}`.toLowerCase();
  if (!keywordsOf(query.keywords).every((keyword) => haystack.includes(keyword))) return false;

  if (query.postedWithin && posting.postedAt) {
    // Whole calendar days in the user's time zone: boards publish dates, so "a week" must
    // include the day exactly 7 days ago, even late in the evening (already tomorrow in UTC).
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS;
    const posted = Math.floor(Date.parse(posting.postedAt.slice(0, 10)) / DAY_MS);
    if (today - posted > DAYS[query.postedWithin]) return false;
  }
  if (query.workplaceTypes?.length && posting.workplaceType) {
    if (!query.workplaceTypes.includes(posting.workplaceType)) return false;
  }
  if (query.location && posting.location) {
    if (!locationMatches(posting.location, query.location)) return false;
  }
  return true;
}

export interface CatalogOptions {
  readonly id: string;
  readonly jobUrl: (externalId: string) => string;
  /** Downloads postings; may use the query to narrow the request when the API supports it. */
  readonly fetch: (query: JobSearchQuery) => Promise<JobDetails[]>;
  /** Requests whose results can be shared; defaults to one key (the whole feed). */
  readonly cacheKey?: (query: JobSearchQuery) => string;
  readonly ttlMs?: number;
  /** For sources published in batches (a monthly thread), where "posted this week" hides all. */
  readonly ignoresAge?: boolean;
  readonly now?: () => Date;
}

export function createCatalogSource({
  id,
  jobUrl,
  fetch,
  cacheKey = () => '*',
  ttlMs = 10 * 60_000,
  ignoresAge = false,
  now = () => new Date(),
}: CatalogOptions): JobSource {
  const downloads = new Map<string, { at: number; postings: JobDetails[] }>();
  const known = new Map<string, JobDetails>();

  return {
    id,
    jobUrl,

    async search(query) {
      const key = cacheKey(query);
      let download = downloads.get(key);
      if (!download || now().getTime() - download.at > ttlMs) {
        download = { at: now().getTime(), postings: await fetch(query) };
        downloads.set(key, download);
        for (const posting of download.postings) known.set(posting.externalId, posting);
      }
      // Titles that name the keywords first: a match buried in a description is weaker.
      const keywords = keywordsOf(query.keywords);
      const titleHits = (posting: JobDetails) =>
        keywords.filter((keyword) => posting.title.toLowerCase().includes(keyword)).length;
      return download.postings
        .filter((posting) =>
          matchesQuery(posting, ignoresAge ? { ...query, postedWithin: undefined } : query, now()),
        )
        .sort(
          (a, b) =>
            titleHits(b) - titleHits(a) || (b.postedAt ?? '').localeCompare(a.postedAt ?? ''),
        )
        .slice(0, query.limit);
    },

    getDetails(externalId) {
      const posting = known.get(externalId);
      if (!posting) {
        return Promise.reject(
          new NotFoundError(`${id} posting (search ${id} first in this session)`, externalId),
        );
      }
      return Promise.resolve(posting);
    },
  };
}
