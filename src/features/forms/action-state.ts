import type { FieldErrors } from '@/core/shared/errors';

/** The contract between every Server Action and the form that submitted it. */
export type ActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly message?: string }
  | { readonly status: 'error'; readonly message: string; readonly fieldErrors?: FieldErrors };

export const IDLE: ActionState = { status: 'idle' };

/** Errors for a field, including nested ones (`highlights.2` belongs to `highlights`). */
export function errorsFor(state: ActionState, name: string): readonly string[] | undefined {
  if (state.status !== 'error' || !state.fieldErrors) return undefined;
  const messages = Object.entries(state.fieldErrors)
    .filter(([key]) => key === name || key.startsWith(`${name}.`))
    .flatMap(([, value]) => value);
  return messages.length ? messages : undefined;
}
