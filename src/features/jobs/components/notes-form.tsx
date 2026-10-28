'use client';

import { CircleCheck } from 'lucide-react';

import { Textarea } from '@/ui/field';
import { SubmitButton } from '@/ui/submit-button';

import { useFormAction } from '../../forms/use-form-action';
import { updateJobNotesAction } from '../actions';

export function NotesForm({ jobId, notes }: { jobId: string; notes: string | null }) {
  const { state, pending, onSubmit } = useFormAction(updateJobNotesAction.bind(null, jobId));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Textarea
        name="notes"
        aria-label="Notes"
        defaultValue={notes ?? ''}
        rows={5}
        placeholder="Recruiter contact, interview dates, salary discussed…"
      />
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
          Save notes
        </SubmitButton>
      </div>
    </form>
  );
}
