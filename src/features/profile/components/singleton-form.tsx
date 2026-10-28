'use client';

import { CircleCheck } from 'lucide-react';

import { Card, CardBody, CardHeader } from '@/ui/card';
import { SubmitButton } from '@/ui/submit-button';

import { FormFields } from '../../forms/form-fields';
import { useFormAction } from '../../forms/use-form-action';
import { updateBasicsAction, updatePreferencesAction } from '../actions';
import { basicsFields, preferencesFields } from '../descriptors';

const FORMS = {
  basics: {
    title: 'Basics',
    description: 'Identity and contact details shown at the top of every résumé.',
    fields: basicsFields,
    action: updateBasicsAction,
  },
  preferences: {
    title: 'Job preferences',
    description: 'What the job-hunting agent searches for and how it judges fit.',
    fields: preferencesFields,
    action: updatePreferencesAction,
  },
} as const;

/** Form for one of the profile's singleton documents (basics, preferences). */
export function SingletonForm({
  kind,
  values,
}: {
  kind: keyof typeof FORMS;
  values: Readonly<Record<string, unknown>> | null;
}) {
  const { title, description, fields, action } = FORMS[kind];
  const { state, pending, onSubmit } = useFormAction(action);

  return (
    <Card id={kind} aria-labelledby={`${kind}-title`} className="scroll-mt-6">
      <CardHeader id={`${kind}-title`} title={title} description={description} />
      <form onSubmit={onSubmit} noValidate>
        <CardBody>
          <FormFields fields={fields} values={values} state={state} />
        </CardBody>
        <footer className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
          {state.status === 'success' && !pending && (
            <span role="status" className="flex items-center gap-1.5 text-sm text-success">
              <CircleCheck className="size-4" aria-hidden />
              {state.message}
            </span>
          )}
          <SubmitButton pending={pending}>Save</SubmitButton>
        </footer>
      </form>
    </Card>
  );
}
