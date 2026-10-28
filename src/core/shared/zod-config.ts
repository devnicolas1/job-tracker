import { z } from 'zod';

/*
 * Human-readable defaults for the few generic zod messages users actually see. Imported for its
 * side effect by `schemas.ts`, so it is active wherever a schema exists. Returning `undefined`
 * keeps zod's default message.
 */
z.config({
  customError: (issue) => {
    if (issue.code === 'invalid_type' && issue.input === undefined)
      return 'This field is required.';
    if (issue.code === 'too_small' && issue.origin === 'string' && issue.minimum === 1) {
      return 'This field is required.';
    }
    if (issue.code === 'invalid_value') return 'Choose one of the options.';
    if (issue.code === 'invalid_format' && issue.format === 'url')
      return 'Enter a full URL (https://…).';
    if (issue.code === 'invalid_format' && issue.format === 'email')
      return 'Enter a valid email address.';
    return undefined;
  },
});
