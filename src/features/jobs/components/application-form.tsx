'use client';

import { CircleCheck } from 'lucide-react';

import { Field, Textarea } from '@/ui/field';
import { SubmitButton } from '@/ui/submit-button';

import { useFormAction } from '../../forms/use-form-action';
import { updateJobApplicationAction } from '../actions';

/** The cover letter and "why me" pitch the agent drafted, editable before applying. */
export function ApplicationForm({
  jobId,
  coverLetter,
  pitch,
}: {
  jobId: string;
  coverLetter: string | null;
  pitch: string | null;
}) {
  const { state, pending, onSubmit } = useFormAction(updateJobApplicationAction.bind(null, jobId));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="Why are you the best pick for this role?" htmlFor="job-pitch">
        <Textarea
          id="job-pitch"
          name="pitch"
          defaultValue={pitch ?? ''}
          rows={5}
          maxLength={3000}
          placeholder="A short answer for the application form's “why you?” question."
        />
      </Field>
      <Field label="Cover letter" htmlFor="job-cover-letter">
        <Textarea
          id="job-cover-letter"
          name="coverLetter"
          defaultValue={coverLetter ?? ''}
          rows={14}
          maxLength={8000}
          placeholder="Written for this posting, from your profile."
        />
      </Field>
      <div className="flex items-center justify-end gap-3">
        {state.status === 'success' && !pending && (
          <span role="status" className="flex items-center gap-1.5 text-sm text-success">
            <CircleCheck className="size-4" aria-hidden /> {state.message}
          </span>
        )}
        {state.status === 'error' && (
          <span role="alert" className="text-sm text-danger">
            {state.message}
          </span>
        )}
        <SubmitButton pending={pending} variant="secondary" size="sm">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
