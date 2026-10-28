import type { z } from 'zod';

import { ValidationError } from './errors';

/** Parses `input` or throws a {@link ValidationError} with per-field messages. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const summary = Object.entries(fieldErrors)
    .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
    .join('; ');
  throw new ValidationError(`Invalid input — ${summary}`, fieldErrors);
}
