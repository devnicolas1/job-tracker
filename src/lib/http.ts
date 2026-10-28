import { NotFoundError, ValidationError } from '@/core/shared/errors';

/** Maps expected domain errors to HTTP responses in route handlers; rethrows anything else. */
export function errorResponse(error: unknown): Response {
  if (error instanceof NotFoundError) return new Response(error.message, { status: 404 });
  if (error instanceof ValidationError) return new Response(error.message, { status: 422 });
  throw error;
}

/** `Content-Disposition` with an RFC 5987 UTF-8 file name, so accents survive downloads. */
export function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/"/g, '');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
