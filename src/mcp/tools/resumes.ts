import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Services } from '@/core/container';
import { RESUME_LANGUAGES, resumeLanguageSchema } from '@/core/shared/schemas';

import { registerTool } from '../tool';

export function registerResumeTools(
  server: McpServer,
  { resumes, tailoredResumes }: Services,
): void {
  registerTool(server, {
    name: 'get_base_resume',
    title: 'Get base résumé outline',
    description:
      "The user's own résumé as numbered paragraphs ([p12] …), to tailor it with edits in " +
      'save_job: replace {id,text}, insert {after,like?,text}, delete {id}. Text uses **bold** ' +
      'and *italic* as shown; the look (fonts, colours, spacing, bullets) is kept automatically.',
    input: z.object({ language: resumeLanguageSchema }),
    annotations: { readOnlyHint: true },
    run: async ({ language }) => (await tailoredResumes.outline(language)).text,
  });

  registerTool(server, {
    name: 'list_base_resumes',
    title: 'List base résumés',
    description:
      "The user's own uploaded résumés (one per language) with absolute file paths, e.g. to " +
      'read one and import its content into the profile.',
    input: z.object({}),
    annotations: { readOnlyHint: true },
    run: () =>
      RESUME_LANGUAGES.map((language) => {
        const stored = resumes.get(language);
        return stored
          ? `${language}: ${stored.absolutePath} (${stored.meta.fileName}, ${Math.ceil(stored.meta.sizeBytes / 1024)} KB)`
          : `${language}: (not uploaded)`;
      }).join('\n'),
  });
}
