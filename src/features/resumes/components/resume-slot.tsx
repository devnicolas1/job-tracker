'use client';

import { CircleAlert, Eye, FileText, LoaderCircle, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';

import type { ResumeFile } from '@/core/resumes/service';
import type { ResumeLanguage } from '@/core/shared/schemas';
import { cn } from '@/lib/cn';
import { formatBytes, formatRelative } from '@/lib/format';
import { Button, buttonClasses } from '@/ui/button';
import { Card } from '@/ui/card';
import { ConfirmButton } from '@/ui/confirm-button';

import { useFormAction } from '../../forms/use-form-action';
import { deleteResumeAction, uploadResumeAction } from '../actions';

const ACCEPT = '.pdf,application/pdf';

/** One language's base résumé: drop zone when empty, file card with actions when uploaded. */
export function ResumeSlot({
  language,
  label,
  file,
}: {
  language: ResumeLanguage;
  label: string;
  file: ResumeFile | undefined;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { state, pending, onSubmit } = useFormAction(uploadResumeAction.bind(null, language), {
    onSuccess: () => formRef.current?.reset(),
  });

  const submit = () => formRef.current?.requestSubmit();
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (inputRef.current && event.dataTransfer.files.length > 0) {
      inputRef.current.files = event.dataTransfer.files;
      submit();
    }
  };

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{label}</h2>
        <span className="font-mono text-xs text-subtle uppercase">{language}</span>
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-1 flex-col">
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept={ACCEPT}
          className="sr-only"
          id={`resume-${language}`}
          onChange={submit}
          disabled={pending}
        />

        {file ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-3">
              <FileText className="size-8 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="truncate font-medium">{file.fileName}</p>
                <p className="text-xs text-subtle">
                  {formatBytes(file.sizeBytes)} · updated {formatRelative(file.updatedAt)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href={`/resumes/${language}`}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({ size: 'sm' })}
              >
                <Eye aria-hidden /> Open
              </a>
              <Button size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
                {pending ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <Upload aria-hidden />
                )}
                Replace
              </Button>
              <div className="ml-auto">
                <ConfirmButton
                  size="sm"
                  label="Remove"
                  confirmLabel="Click again to remove"
                  onConfirm={async () => {
                    await deleteResumeAction(language);
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <label
            htmlFor={`resume-${language}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => {
              setDragging(false);
            }}
            onDrop={onDrop}
            className={cn(
              'flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-8 text-center text-muted transition-colors',
              'hover:border-border-strong hover:bg-surface-muted has-focus-visible:ring-[3px] has-focus-visible:ring-ring',
              dragging && 'border-accent bg-accent-soft text-accent',
            )}
          >
            {pending ? (
              <LoaderCircle className="size-6 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-6" aria-hidden />
            )}
            <span className="font-medium text-text">
              {pending ? 'Uploading…' : 'Drop a file or click to upload'}
            </span>
            <span className="text-xs">PDF exported from your editor, up to 5 MB</span>
          </label>
        )}

        {state.status === 'error' && (
          <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-danger">
            <CircleAlert className="size-4" aria-hidden />
            {state.message}
          </p>
        )}
      </form>
    </Card>
  );
}
