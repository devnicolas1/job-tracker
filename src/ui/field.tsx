import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/* No width here: inside a Field (flex column) controls stretch, elsewhere callers size them. */
const controlClasses = cn(
  'bg-surface text-text border-border placeholder:text-subtle min-w-0 rounded-lg border px-3 shadow-xs transition-colors',
  'hover:border-border-strong focus-visible:border-accent disabled:opacity-60',
  'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25',
);

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(controlClasses, 'h-9', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(controlClasses, 'min-h-20 py-2 leading-relaxed', className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(controlClasses, 'h-9 pr-8', className)} {...props} />;
}

/**
 * Label + control + hint/error, wired for assistive technology: the control is described by the
 * hint and flagged invalid when there is an error. Pass the control's `id` as `htmlFor`.
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: readonly string[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-text">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error?.length ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger">
          {error.join(' ')}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="text-xs text-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Props that link a control to its {@link Field}'s hint or error message. */
export function describedBy(
  id: string,
  { hint, error }: { hint?: string; error?: readonly string[] },
) {
  const invalid = Boolean(error?.length);
  return {
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}
