'use client';

import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { useState, useTransition } from 'react';

import type { ProfileEntry, ProfileSection } from '@/core/profile/schemas';
import { cn } from '@/lib/cn';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardBody, CardHeader } from '@/ui/card';
import { ConfirmButton } from '@/ui/confirm-button';
import { Dialog } from '@/ui/dialog';
import { SubmitButton } from '@/ui/submit-button';

import { FormFields } from '../../forms/form-fields';
import { useFormAction } from '../../forms/use-form-action';
import { deleteEntryAction, moveEntryAction, saveEntryAction } from '../actions';
import { getSectionDescriptor, type SectionDescriptor } from '../descriptors';

type Editing = { readonly entry?: ProfileEntry } | null;

export function SectionEditor({
  section,
  entries,
}: {
  section: ProfileSection;
  entries: readonly ProfileEntry[];
}) {
  const descriptor = getSectionDescriptor(section);
  const [editing, setEditing] = useState<Editing>(null);
  const close = () => {
    setEditing(null);
  };

  return (
    <Card id={section} aria-labelledby={`${section}-title`} className="scroll-mt-6">
      <CardHeader
        id={`${section}-title`}
        title={
          <span className="flex items-center gap-2">
            {descriptor.title}
            {entries.length > 0 && <Badge>{entries.length}</Badge>}
          </span>
        }
        description={descriptor.description}
        actions={
          <Button
            size="sm"
            aria-label={`Add ${descriptor.noun}`}
            onClick={() => {
              setEditing({});
            }}
          >
            <Plus aria-hidden /> Add
          </Button>
        }
      />
      <CardBody>
        {entries.length === 0 ? (
          <p className="py-2 text-sm text-subtle">No {descriptor.noun} added yet.</p>
        ) : descriptor.layout === 'chips' ? (
          <ChipList
            descriptor={descriptor}
            entries={entries}
            onEdit={(entry) => {
              setEditing({ entry });
            }}
          />
        ) : (
          <EntryList
            descriptor={descriptor}
            entries={entries}
            onEdit={(entry) => {
              setEditing({ entry });
            }}
          />
        )}
      </CardBody>

      <Dialog
        open={editing !== null}
        onClose={close}
        size={descriptor.layout === 'list' ? 'lg' : 'md'}
        title={`${editing?.entry ? 'Edit' : 'Add'} ${descriptor.noun}`}
      >
        {editing && (
          <EntryForm
            // Remount per entry so uncontrolled inputs pick up the right default values.
            key={editing.entry?.id ?? 'new'}
            descriptor={descriptor}
            entry={editing.entry}
            onDone={close}
          />
        )}
      </Dialog>
    </Card>
  );
}

function EntryList({
  descriptor,
  entries,
  onEdit,
}: {
  descriptor: SectionDescriptor<ProfileSection>;
  entries: readonly ProfileEntry[];
  onEdit: (entry: ProfileEntry) => void;
}) {
  const [pending, startTransition] = useTransition();
  const move = (id: string, direction: 'up' | 'down') => {
    startTransition(async () => {
      await moveEntryAction(id, direction);
    });
  };

  return (
    <ul className={cn('-my-1 divide-y divide-border', pending && 'opacity-60')}>
      {entries.map((entry, index) => {
        const summary = descriptor.summarize(entry.data);
        return (
          <li key={entry.id} className="group flex gap-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="font-medium">{summary.title}</h3>
                {summary.meta && <span className="text-xs text-subtle">{summary.meta}</span>}
              </div>
              {summary.subtitle && <p className="text-muted">{summary.subtitle}</p>}
              {summary.body && <p className="mt-1 line-clamp-2 text-muted">{summary.body}</p>}
              {summary.tags && summary.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {summary.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-start gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Move up"
                disabled={index === 0 || pending}
                onClick={() => {
                  move(entry.id, 'up');
                }}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Move down"
                disabled={index === entries.length - 1 || pending}
                onClick={() => {
                  move(entry.id, 'down');
                }}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${summary.title}`}
                onClick={() => {
                  onEdit(entry);
                }}
              >
                <Pencil />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ChipList({
  descriptor,
  entries,
  onEdit,
}: {
  descriptor: SectionDescriptor<ProfileSection>;
  entries: readonly ProfileEntry[];
  onEdit: (entry: ProfileEntry) => void;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {entries.map((entry) => {
        const summary = descriptor.summarize(entry.data);
        return (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => {
                onEdit(entry);
              }}
              title={[summary.subtitle, summary.meta].filter(Boolean).join(' · ')}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm transition-colors hover:border-border-strong hover:bg-surface-muted"
            >
              <span className="font-medium">{summary.title}</span>
              {summary.meta && <span className="text-xs text-subtle">{summary.meta}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EntryForm({
  descriptor,
  entry,
  onDone,
}: {
  descriptor: SectionDescriptor<ProfileSection>;
  entry: ProfileEntry | undefined;
  onDone: () => void;
}) {
  const { state, pending, onSubmit } = useFormAction(
    saveEntryAction.bind(null, descriptor.section, entry?.id),
    { onSuccess: onDone },
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
      <div className="overflow-y-auto px-6 py-5">
        <FormFields fields={descriptor.fields} values={entry?.data} state={state} />
      </div>
      <footer className="flex items-center gap-2 border-t border-border px-6 py-3">
        {entry && (
          <ConfirmButton
            onConfirm={async () => {
              const result = await deleteEntryAction(entry.id);
              if (result.status === 'success') onDone();
            }}
          />
        )}
        <div className="ml-auto flex gap-2">
          <Button onClick={onDone}>Cancel</Button>
          <SubmitButton pending={pending}>Save</SubmitButton>
        </div>
      </footer>
    </form>
  );
}
