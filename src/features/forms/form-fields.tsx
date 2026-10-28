'use client';

import { CircleAlert } from 'lucide-react';

import { errorsFor, type ActionState } from './action-state';
import { FieldControl } from './field-control';
import type { FieldDescriptor } from './fields';

/** A two-column grid of descriptor-driven fields with a form-level error banner. */
export function FormFields({
  fields,
  values,
  state,
}: {
  fields: readonly FieldDescriptor[];
  values: Readonly<Record<string, unknown>> | null | undefined;
  state: ActionState;
}) {
  return (
    <>
      {state.status === 'error' && (
        <p
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        {fields.map((field) => (
          <FieldControl
            key={field.name}
            field={field}
            value={values?.[field.name]}
            error={errorsFor(state, field.name)}
          />
        ))}
      </div>
    </>
  );
}
