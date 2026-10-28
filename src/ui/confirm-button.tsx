'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button, type ButtonSize } from './button';

/**
 * Two-step destructive button: the first click arms it, the second runs `onConfirm`. Lighter than
 * a confirmation modal and impossible to trigger by a single stray click. Disarms on blur.
 */
export function ConfirmButton({
  onConfirm,
  label = 'Delete',
  confirmLabel = 'Click again to delete',
  size = 'md',
}: {
  onConfirm: () => Promise<void>;
  label?: string;
  confirmLabel?: string;
  size?: ButtonSize;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={armed ? 'danger' : 'ghost'}
      size={size}
      disabled={pending}
      onBlur={() => {
        setArmed(false);
      }}
      onClick={() => {
        if (armed) startTransition(onConfirm);
        else setArmed(true);
      }}
    >
      <Trash2 aria-hidden />
      {armed ? confirmLabel : label}
    </Button>
  );
}
