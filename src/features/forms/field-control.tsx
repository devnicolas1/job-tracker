'use client';

import { useId } from 'react';

import { cn } from '@/lib/cn';
import { describedBy, Field, Input, Select, Textarea } from '@/ui/field';

import type { FieldDescriptor } from './fields';

const INPUT_TYPES = {
  text: 'text',
  email: 'email',
  url: 'url',
  tel: 'tel',
  month: 'month',
  number: 'number',
} as const;

/** Renders one {@link FieldDescriptor} with its label, hint and validation errors. */
export function FieldControl({
  field,
  value,
  error,
}: {
  field: FieldDescriptor;
  value: unknown;
  error?: readonly string[] | undefined;
}) {
  const id = useId();
  const { name, kind, label, required, hint, placeholder, options = [] } = field;
  const aria = describedBy(id, { hint, error });
  const wrapper = cn(field.wide && 'sm:col-span-2');

  if (kind === 'checkbox') {
    return (
      <label className={cn('flex items-center gap-2.5 text-sm', wrapper)}>
        <input
          type="checkbox"
          name={name}
          defaultChecked={value === true}
          className="size-4 accent-accent"
        />
        {label}
      </label>
    );
  }

  if (kind === 'multiselect') {
    const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
    return (
      <fieldset className={cn('flex flex-col gap-1.5', wrapper)}>
        <legend className="mb-1.5 text-[13px] font-medium">{label}</legend>
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                'cursor-pointer rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition-colors select-none',
                'hover:border-border-strong has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent',
                'has-focus-visible:ring-[3px] has-focus-visible:ring-ring',
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={option.value}
                defaultChecked={selected.has(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        {hint && <p className="text-xs text-subtle">{hint}</p>}
      </fieldset>
    );
  }

  const common = { id, name, required, placeholder, ...aria };
  let control;
  switch (kind) {
    case 'textarea':
      control = (
        <Textarea {...common} rows={4} defaultValue={(value as string | undefined) ?? ''} />
      );
      break;
    case 'lines':
      control = (
        <Textarea
          {...common}
          rows={4}
          defaultValue={Array.isArray(value) ? value.join('\n') : ''}
        />
      );
      break;
    case 'tags':
      control = <Input {...common} defaultValue={Array.isArray(value) ? value.join(', ') : ''} />;
      break;
    case 'select':
      control = (
        <Select {...common} defaultValue={(value as string | undefined) ?? ''}>
          {!required && <option value="">—</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
      break;
    default:
      control = (
        <Input
          {...common}
          type={INPUT_TYPES[kind]}
          step={kind === 'number' ? 'any' : undefined}
          defaultValue={typeof value === 'string' || typeof value === 'number' ? value : ''}
        />
      );
  }

  return (
    <Field
      label={label}
      htmlFor={id}
      required={required}
      hint={hint}
      error={error}
      className={wrapper}
    >
      {control}
    </Field>
  );
}
