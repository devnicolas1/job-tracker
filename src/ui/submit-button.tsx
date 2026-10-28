'use client';

import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button, type ButtonProps } from './button';

/** Submit button that shows a spinner and blocks double submission while `pending`. */
export function SubmitButton({
  pending,
  children,
  variant = 'primary',
  ...props
}: Omit<ButtonProps, 'type'> & { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} {...props}>
      {pending && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
