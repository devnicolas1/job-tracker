import { randomBytes } from 'node:crypto';

/**
 * 64 random bits, base64url-encoded (11 characters). Ample for a single-user database, and about
 * a quarter of the tokens of a UUID — ids are echoed in every listing an agent reads.
 */
export const createId = (): string => randomBytes(8).toString('base64url');
