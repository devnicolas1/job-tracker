import { z } from 'zod';

/** Unwraps optional/default/nullable wrappers to reach the underlying type. */
function unwrap(schema: z.ZodType): z.ZodType {
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodNullable
  ) {
    return unwrap(schema.unwrap() as z.ZodType);
  }
  if (schema instanceof z.ZodPipe) return unwrap(schema.in as z.ZodType);
  return schema;
}

/**
 * Turns an object schema into a "patch" schema: every field optional and, unlike `.partial()`,
 * with defaults removed — otherwise omitted fields would be reset to their defaults.
 */
export function toPatchSchema<T extends Record<string, z.ZodType>>(schema: z.ZodObject<T>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => {
      const inner = field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : field;
      const optional = inner.optional();
      return [key, field.description ? optional.describe(field.description) : optional];
    }),
  );
  return z.object(shape as { [K in keyof T]: z.ZodOptional<z.ZodType<z.output<T[K]>>> });
}

/**
 * One-line field reference for a schema, e.g.
 * `company*, startDate* (YYYY-MM), employmentType (full-time|part-time), highlights[]`.
 * Lets one generic tool document many record shapes for a fraction of the JSON-Schema tokens.
 */
export function describeFields(schema: z.ZodObject): string {
  return Object.entries(schema.shape as Record<string, z.ZodType>)
    .map(([key, field]) => {
      const type = unwrap(field);
      const required = !field.safeParse(undefined).success;
      let label = `${key}${required ? '*' : ''}`;
      if (type instanceof z.ZodArray) label += '[]';
      else if (type instanceof z.ZodEnum) label += ` (${type.options.join('|')})`;
      else if (type instanceof z.ZodNumber) label += ' (number)';
      else if (type instanceof z.ZodBoolean) label += ' (boolean)';
      else if (field.description?.includes('YYYY-MM') || type.description?.includes('YYYY-MM')) {
        label += ' (YYYY-MM)';
      }
      return label;
    })
    .join(', ');
}
