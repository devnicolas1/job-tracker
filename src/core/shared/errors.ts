/**
 * Expected, user-facing failures. Adapters (Server Actions, MCP tools) translate these into
 * friendly messages; anything else is a bug and is allowed to propagate.
 */
export class DomainError extends Error {
  override readonly name: string = 'DomainError';
}

export class NotFoundError extends DomainError {
  override readonly name = 'NotFoundError';

  constructor(entity: string, id: string) {
    super(`${entity} "${id}" was not found.`);
  }
}

export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export class ValidationError extends DomainError {
  override readonly name = 'ValidationError';

  constructor(
    message: string,
    /** Messages keyed by dotted field path (`highlights.2`), for inline form errors. */
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
  }
}
