'use server';

import { z } from 'zod';

import { getServices } from '@/core/container';
import { profileSectionSchema } from '@/core/profile/schemas';
import { parseInput } from '@/core/shared/validation';

import type { ActionState } from '../forms/action-state';
import { parseFormValues } from '../forms/fields';
import { runAction } from '../forms/run-action';
import { basicsFields, preferencesFields, sectionDescriptors } from './descriptors';

/*
 * Server Actions are public HTTP endpoints: every argument coming from the client is validated,
 * not just the form data.
 */

const revalidate = ['/profile'];
const idSchema = z.string().min(1).max(64);
const directionSchema = z.enum(['up', 'down']);

export async function updateBasicsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    () => getServices().profiles.updateBasics(parseFormValues(basicsFields, formData)),
    { revalidate, success: 'Basics saved.' },
  );
}

export async function updatePreferencesAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(
    () => getServices().profiles.updatePreferences(parseFormValues(preferencesFields, formData)),
    { revalidate, success: 'Preferences saved.' },
  );
}

export async function saveEntryAction(
  section: unknown,
  id: unknown,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(
    () => {
      const validSection = parseInput(profileSectionSchema, section);
      const values = parseFormValues(sectionDescriptors[validSection].fields, formData);
      getServices().profiles.saveEntry(validSection, values, parseInput(idSchema.optional(), id));
    },
    { revalidate },
  );
}

export async function deleteEntryAction(id: unknown): Promise<ActionState> {
  return runAction(
    () => {
      getServices().profiles.deleteEntry(parseInput(idSchema, id));
    },
    {
      revalidate,
    },
  );
}

export async function moveEntryAction(id: unknown, direction: unknown): Promise<ActionState> {
  return runAction(
    () => {
      getServices().profiles.moveEntry(
        parseInput(idSchema, id),
        parseInput(directionSchema, direction),
      );
    },
    { revalidate },
  );
}
