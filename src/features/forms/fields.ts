/*
 * Declarative form fields. A form is a list of descriptors; rendering (FieldControl) and parsing
 * (parseFormValues) are generic, and the zod schemas in `core` stay the single source of truth
 * for validation.
 */

export type FieldKind =
  | 'text'
  | 'email'
  | 'url'
  | 'tel'
  | 'textarea'
  | 'month'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  /** One item per line → string[] */
  | 'lines'
  /** Comma-separated → string[] */
  | 'tags';

export interface FieldOption {
  readonly value: string;
  readonly label: string;
}

export interface FieldDescriptor<Name extends string = string> {
  readonly name: Name;
  readonly label: string;
  readonly kind: FieldKind;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly options?: readonly FieldOption[];
  /** Spans both columns of the form grid. */
  readonly wide?: boolean;
}

/** Keeps descriptor names in sync with the shape they edit. */
export type FieldsFor<T> = readonly FieldDescriptor<Extract<keyof T, string>>[];

export function toOptions(
  values: readonly string[],
  labels: Partial<Record<string, string>> = {},
): FieldOption[] {
  return values.map((value) => ({
    value,
    label: labels[value] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' '),
  }));
}

const splitList = (raw: string, separator: RegExp) =>
  raw
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Converts submitted form data into a plain object for schema validation. Empty inputs become
 * `undefined` so optional fields are omitted rather than stored as empty strings.
 */
export function parseFormValues(
  fields: readonly FieldDescriptor[],
  formData: FormData,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const { name, kind } of fields) {
    if (kind === 'checkbox') {
      values[name] = formData.get(name) === 'on';
      continue;
    }
    if (kind === 'multiselect') {
      values[name] = formData
        .getAll(name)
        .filter((value): value is string => typeof value === 'string');
      continue;
    }

    const raw = formData.get(name);
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (kind === 'lines') values[name] = splitList(text, /\r?\n/);
    else if (kind === 'tags') values[name] = splitList(text, /,/);
    else if (text === '') values[name] = undefined;
    else if (kind === 'number') values[name] = Number(text);
    else values[name] = text;
  }
  return values;
}
