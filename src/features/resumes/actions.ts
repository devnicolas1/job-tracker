'use server';

import { getServices } from '@/core/container';
import { ValidationError } from '@/core/shared/errors';
import { resumeLanguageSchema } from '@/core/shared/schemas';
import { parseInput } from '@/core/shared/validation';

import type { ActionState } from '../forms/action-state';
import { runAction } from '../forms/run-action';

const revalidate = ['/resumes'];

export async function uploadResumeAction(
  language: unknown,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(
    async () => {
      const file = formData.get('file');
      if (!(file instanceof File) || file.size === 0) {
        throw new ValidationError('Choose a file to upload.');
      }
      await getServices().resumes.upload({
        language: parseInput(resumeLanguageSchema, language),
        fileName: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    },
    { revalidate, success: 'Résumé uploaded.' },
  );
}

export async function deleteResumeAction(language: unknown): Promise<ActionState> {
  return runAction(() => getServices().resumes.remove(parseInput(resumeLanguageSchema, language)), {
    revalidate,
  });
}
