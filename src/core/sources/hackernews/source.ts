import { z } from 'zod';

import { detectLanguage, htmlToText } from '@/core/shared/text';

import { createCatalogSource, keywordsOf } from '../catalog';
import { API_USER_AGENT, createHttpClient, SourceUnavailableError, type HttpClient } from '../http';
import { isoDate, workplaceTypeFrom } from '../normalize';
import type { JobDetails, JobSource } from '../types';

/*
 * Hacker News' monthly "Ask HN: Who is hiring?" thread, through the Algolia HN API. Each top-level
 * comment is one company's post, conventionally headed "Company | Role | Location | …".
 */
const API = 'https://hn.algolia.com/api/v1';

const storiesSchema = z.object({
  hits: z.array(z.object({ objectID: z.string(), title: z.string().nullish() })),
});
const commentsSchema = z.object({
  hits: z.array(
    z.object({
      objectID: z.string(),
      parent_id: z.number().nullish(),
      story_id: z.number().nullish(),
      comment_text: z.string().nullish(),
      created_at: z.string().nullish(),
    }),
  ),
});

export function parseWhoIsHiring(body: unknown): JobDetails[] {
  const parsed = commentsSchema.safeParse(body);
  if (!parsed.success) throw new SourceUnavailableError('HN Algolia changed its API format.');

  return parsed.data.hits.flatMap((hit) => {
    // Replies are discussions, not job posts.
    if (!hit.comment_text || hit.parent_id !== hit.story_id) return [];
    const description = htmlToText(hit.comment_text);
    const [header = ''] = description.split('\n');
    const [company, role, ...rest] = header.split('|').map((part) => part.trim());
    if (!company || company.length > 80) return [];

    return {
      externalId: hit.objectID,
      url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      title: role && role.length <= 120 ? role : 'Multiple roles',
      company,
      location: rest.join(' | ') || undefined,
      workplaceType: workplaceTypeFrom(header),
      postedAt: isoDate(hit.created_at),
      language: detectLanguage(description),
      description,
    };
  });
}

export function createHackerNewsSource(
  http: HttpClient = createHttpClient({ minIntervalMs: 500, userAgent: API_USER_AGENT }),
): JobSource {
  let thread: Promise<string | null> | null = null;
  const latestThread = async () => {
    const body = await http.getJson(
      `${API}/search_by_date?tags=story,author_whoishiring&hitsPerPage=5`,
    );
    const stories = storiesSchema.safeParse(body);
    const story = stories.success
      ? stories.data.hits.find((hit) => hit.title?.startsWith('Ask HN: Who is hiring?'))
      : undefined;
    return story?.objectID ?? null;
  };

  return createCatalogSource({
    id: 'hackernews',
    jobUrl: (id) => `https://news.ycombinator.com/item?id=${id}`,
    cacheKey: (query) => keywordsOf(query.keywords).join(' '),
    // The thread is posted monthly: "posted within a week" would hide most of it.
    ignoresAge: true,
    fetch: async (query) => {
      thread ??= latestThread();
      const storyId = await thread;
      if (!storyId) return [];
      const params = new URLSearchParams({
        tags: `comment,story_${storyId}`,
        query: keywordsOf(query.keywords).join(' '),
        hitsPerPage: '100',
      });
      return parseWhoIsHiring(await http.getJson(`${API}/search?${params.toString()}`));
    },
  });
}
