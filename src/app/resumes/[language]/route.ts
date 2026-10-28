import fs from 'node:fs/promises';

import { getServices } from '@/core/container';
import { NotFoundError } from '@/core/shared/errors';
import { resumeLanguageSchema } from '@/core/shared/schemas';
import { contentDisposition, errorResponse } from '@/lib/http';

/** Serves an uploaded base résumé. PDFs open inline; other formats download. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ language: string }> },
) {
  const { language } = await params;
  try {
    const parsed = resumeLanguageSchema.safeParse(language);
    const stored = parsed.success ? getServices().resumes.get(parsed.data) : null;
    if (!stored) throw new NotFoundError('Résumé', language);

    const bytes = await fs.readFile(stored.absolutePath);
    const disposition = stored.meta.mimeType === 'application/pdf' ? 'inline' : 'attachment';
    return new Response(new Uint8Array(bytes), {
      headers: {
        'content-type': stored.meta.mimeType,
        'content-disposition': contentDisposition(disposition, stored.meta.fileName),
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
