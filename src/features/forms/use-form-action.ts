'use client';

import { startTransition, useActionState, type SubmitEvent } from 'react';

import { IDLE, type ActionState } from './action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Submits a form to a Server Action and tracks its state.
 *
 * Why not `<form action={…}>`? React 19 resets uncontrolled forms after an action runs, which
 * would wipe the user's input whenever validation fails. Submitting from `onSubmit` keeps the
 * input; `onSuccess` lets the caller close a dialog or reset explicitly.
 */
export function useFormAction(action: FormAction, { onSuccess }: { onSuccess?: () => void } = {}) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await action(previous, formData);
      if (next.status === 'success') onSuccess?.();
      return next;
    },
    IDLE,
  );

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Outside a form `action`, the dispatch must be wrapped in a transition explicitly.
    startTransition(() => {
      dispatch(formData);
    });
  }

  return { state, pending, onSubmit };
}
