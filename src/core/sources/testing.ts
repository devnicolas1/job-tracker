import fs from 'node:fs';
import path from 'node:path';

import type { HttpClient } from './http';

/** Reads a fixture next to a source's tests. */
export const readFixture = (dir: string, name: string) =>
  fs.readFileSync(path.join(dir, '__fixtures__', name), 'utf8');

/** HTTP client answering from canned bodies, matched by URL substring. Records requested URLs. */
export function fakeHttp(
  responses: Readonly<Record<string, string>>,
): HttpClient & { urls: string[] } {
  const urls: string[] = [];
  const getText = (url: string) => {
    urls.push(url);
    const match = Object.entries(responses).find(([fragment]) => url.includes(fragment));
    return Promise.resolve(match ? match[1] : null);
  };
  return {
    urls,
    getText,
    getJson: async (url) => {
      const text = await getText(url);
      return text === null ? null : (JSON.parse(text) as unknown);
    },
  };
}
