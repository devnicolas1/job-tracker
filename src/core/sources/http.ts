import { DomainError } from '@/core/shared/errors';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

export class SourceUnavailableError extends DomainError {
  override readonly name = 'SourceUnavailableError';
}

export interface HttpClientOptions {
  /** Minimum delay between consecutive requests, to stay well clear of rate limits. */
  readonly minIntervalMs: number;
  /** Public APIs get an honest agent string; HTML pages get a browser one. */
  readonly userAgent?: string;
  readonly timeoutMs?: number;
  readonly fetch?: typeof globalThis.fetch;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface RequestOptions {
  /** Extra request headers, e.g. a tenant id some multi-tenant APIs require. */
  readonly headers?: Readonly<Record<string, string>>;
}

export const API_USER_AGENT = 'job-tracker/0.1 (personal job search; low volume)';

export interface HttpClient {
  /** Returns the body, or `null` on 404. Throws {@link SourceUnavailableError} otherwise. */
  getText(url: string, options?: RequestOptions): Promise<string | null>;
  /** Parsed JSON body, or `null` on 404. Callers validate the shape. */
  getJson(url: string, options?: RequestOptions): Promise<unknown>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A tiny, throttled HTML fetcher with a single back-off retry on rate limiting. */
export function createHttpClient({
  minIntervalMs,
  userAgent = BROWSER_USER_AGENT,
  timeoutMs = 15_000,
  fetch = globalThis.fetch,
  sleep = defaultSleep,
}: HttpClientOptions): HttpClient {
  let nextSlot = 0;

  async function throttle(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + minIntervalMs;
    if (wait > 0) await sleep(wait);
  }

  async function request(
    url: string,
    attempt: number,
    options: RequestOptions = {},
  ): Promise<string | null> {
    await throttle();
    const response = await fetch(url, {
      headers: { 'user-agent': userAgent, 'accept-language': 'en-US,en;q=0.9', ...options.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) return response.text();
    if (response.status === 404) return null;
    if (response.status === 429 && attempt === 0) {
      await sleep(5_000);
      return request(url, attempt + 1, options);
    }
    throw new SourceUnavailableError(
      `${new URL(url).hostname} answered ${response.status}. ` +
        (response.status === 429
          ? 'It is rate limiting us: wait a few minutes before searching again.'
          : 'Try again later.'),
    );
  }

  return {
    getText: (url, options) => request(url, 0, options),
    async getJson(url, options) {
      const text = await request(url, 0, options);
      if (text === null) return null;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new SourceUnavailableError(`${new URL(url).hostname} returned invalid JSON.`);
      }
    },
  };
}
