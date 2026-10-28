'use server';

import { z } from 'zod';

import { getServices } from '@/core/container';
import { jobStatusSchema } from '@/core/jobs/schemas';
import { parseInput } from '@/core/shared/validation';

import type { ActionState } from '../forms/action-state';
import { runAction } from '../forms/run-action';

const idSchema = z.string().min(1).max(64);

const pathsFor = (id: string) => ['/jobs', `/jobs/${id}`, '/resumes'];

export async function updateJobStatusAction(id: unknown, status: unknown): Promise<ActionState> {
  return runAction(
    () =>
      getServices().jobs.updateStatus(
        parseInput(idSchema, id),
        parseInput(jobStatusSchema, status),
      ),
    { revalidate: pathsFor(String(id)) },
  );
}

export async function updateJobNotesAction(
  id: unknown,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const notes = formData.get('notes');
  return runAction(
    () =>
      getServices().jobs.updateNotes(
        parseInput(idSchema, id),
        typeof notes === 'string' ? notes : '',
      ),
    { revalidate: pathsFor(String(id)), success: 'Notes saved.' },
  );
}

export async function deleteJobAction(id: unknown): Promise<ActionState> {
  return runAction(
    () => {
      getServices().jobs.remove(parseInput(idSchema, id));
    },
    {
      revalidate: ['/jobs', '/resumes'],
    },
  );
}
