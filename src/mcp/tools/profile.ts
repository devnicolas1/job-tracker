import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Services } from '@/core/container';
import {
  jobPreferencesSchema,
  PROFILE_SECTIONS,
  profileBasicsSchema,
  profileSectionSchema,
  profileSectionSchemas,
} from '@/core/profile/schemas';

import { formatProfile } from '../format';
import { describeFields, toPatchSchema } from '../schemas';
import { registerTool } from '../tool';

const sectionReference = PROFILE_SECTIONS.map(
  (section) => `- ${section}: ${describeFields(profileSectionSchemas[section])}`,
).join('\n');

export function registerProfileTools(server: McpServer, { profiles }: Services): void {
  registerTool(server, {
    name: 'get_profile',
    title: 'Get profile',
    description:
      'The candidate profile as compact text: basics, job-search preferences and every section ' +
      'entry with its [id]. Pass `sections` to fetch only part of it.',
    input: z.object({ sections: z.array(profileSectionSchema).optional() }),
    annotations: { readOnlyHint: true },
    run: ({ sections }) => formatProfile(profiles.getProfile(), sections),
  });

  registerTool(server, {
    name: 'update_profile_basics',
    title: 'Update profile basics',
    description: 'Updates name, contact details, headline or summary. Omitted fields are kept.',
    input: z.object({ patch: toPatchSchema(profileBasicsSchema) }),
    run: ({ patch }) => {
      const current = profiles.getProfile().basics;
      profiles.updateBasics({ ...current, ...patch });
      return 'Basics updated.';
    },
  });

  registerTool(server, {
    name: 'update_job_preferences',
    title: 'Update job preferences',
    description:
      'Updates what the job search targets (roles, seniority, locations, keywords…). ' +
      'Omitted fields are kept; list fields are replaced as a whole.',
    input: z.object({ patch: toPatchSchema(jobPreferencesSchema) }),
    run: ({ patch }) => {
      profiles.updatePreferences({ ...profiles.getProfile().preferences, ...patch });
      return 'Preferences updated.';
    },
  });

  registerTool(server, {
    name: 'save_profile_entry',
    title: 'Save profile entry',
    description:
      'Creates an entry in a profile section, or replaces one when `id` is given (send all ' +
      'fields). Fields per section (* = required):\n' +
      sectionReference,
    input: z.object({
      section: profileSectionSchema,
      id: z.string().optional(),
      data: z.record(z.string(), z.unknown()),
    }),
    run: ({ section, id, data }) => {
      const entry = profiles.saveEntry(section, data, id);
      return `${id ? 'Updated' : 'Created'} ${section} [${entry.id}].`;
    },
  });

  registerTool(server, {
    name: 'delete_profile_entry',
    title: 'Delete profile entry',
    description: 'Deletes a profile entry by id.',
    input: z.object({ id: z.string() }),
    annotations: { destructiveHint: true },
    run: ({ id }) => {
      profiles.deleteEntry(id);
      return `Deleted [${id}].`;
    },
  });
}
