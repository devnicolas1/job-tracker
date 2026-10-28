'use client';

import { Check, ClipboardCopy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, type ButtonVariant } from '@/ui/button';

type State = 'idle' | 'copied' | 'failed';

/**
 * Copies an agent prompt to the clipboard. If the browser refuses (no permission, insecure
 * context), the prompt is shown selected instead, so a manual copy still works.
 */
export function CopyPromptButton({
  prompt,
  label,
  variant = 'secondary',
}: {
  prompt: string;
  label: string;
  variant?: ButtonVariant;
}) {
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (state !== 'copied') return;
    const timer = setTimeout(() => {
      setState('idle');
    }, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, [state]);

  if (state === 'failed') {
    return (
      <input
        readOnly
        value={prompt}
        aria-label="Prompt to copy"
        autoFocus
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        className="h-8 w-56 rounded-md border border-border bg-surface px-2 font-mono text-xs"
      />
    );
  }

  return (
    <Button
      size="sm"
      variant={variant}
      title={prompt}
      onClick={() => {
        navigator.clipboard.writeText(prompt).then(
          () => {
            setState('copied');
          },
          () => {
            setState('failed');
          },
        );
      }}
    >
      {state === 'copied' ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
      <span aria-live="polite">
        {state === 'copied' ? 'Copied — paste it into your agent' : label}
      </span>
    </Button>
  );
}
