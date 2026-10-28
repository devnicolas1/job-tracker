import { describe, expect, it } from 'vitest';

import { parseFormValues, type FieldDescriptor } from './fields';

const fields: FieldDescriptor[] = [
  { name: 'title', label: 'Title', kind: 'text' },
  { name: 'empty', label: 'Empty', kind: 'url' },
  { name: 'years', label: 'Years', kind: 'number' },
  { name: 'highlights', label: 'Highlights', kind: 'lines' },
  { name: 'technologies', label: 'Technologies', kind: 'tags' },
  { name: 'workplace', label: 'Workplace', kind: 'multiselect' },
  { name: 'relocate', label: 'Relocate', kind: 'checkbox' },
];

describe('parseFormValues', () => {
  it('converts each kind of input to its schema-ready value', () => {
    const form = new FormData();
    form.set('title', '  Engineer ');
    form.set('empty', '');
    form.set('years', '4.5');
    form.set('highlights', 'Shipped X\r\n\n  Led Y  ');
    form.set('technologies', 'TypeScript, , Go ');
    form.append('workplace', 'remote');
    form.append('workplace', 'hybrid');

    expect(parseFormValues(fields, form)).toEqual({
      title: 'Engineer',
      empty: undefined,
      years: 4.5,
      highlights: ['Shipped X', 'Led Y'],
      technologies: ['TypeScript', 'Go'],
      workplace: ['remote', 'hybrid'],
      relocate: false,
    });
  });
});
