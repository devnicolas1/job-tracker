import 'server-only';

import { revalidatePath } from 'next/cache';

import { DomainError, ValidationError } from '@/core/shared/errors';

import type { ActionState } from './action-state';

/**
 * Runs a Server Action body, turning expected domain failures into an {@link ActionState} the
 * form can render. Unexpected errors still throw, reaching the nearest error boundary.
 */
export async function runAction(
  task: () => unknown,
  { revalidate = [], success }: { revalidate?: readonly string[]; success?: string } = {},
): Promise<ActionState> {
  try {
    await task();
  } catch (error) {
    if (error instanceof ValidationError && Object.keys(error.fieldErrors).length > 0) {
      return {
        status: 'error',
        message: 'Please fix the highlighted fields.',
        fieldErrors: error.fieldErrors,
      };
    }
    if (error instanceof DomainError) return { status: 'error', message: error.message };
    throw error;
  }

  for (const path of revalidate) revalidatePath(path);
  return success ? { status: 'success', message: success } : { status: 'success' };
}
