import { getServices } from '@/core/container';
import { NotFoundError } from '@/core/shared/errors';
import { contentDisposition, errorResponse } from '@/lib/http';

/**
 * Renders a job's tailored résumé: the base résumé PDF with the agent's edits applied. Nothing is
 * cached on disk, so the file always reflects the current base résumé.
 * `?download=1` forces a download instead of inline display.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { jobs, tailoredResumes } = getServices();
    const job = jobs.get(id);
    if (!job.tailoredResume) throw new NotFoundError('Tailored résumé for job', id);

    const { fileName, pdf } = await tailoredResumes.render(job.tailoredResume, job.company);
    const download = new URL(request.url).searchParams.has('download');
    return new Response(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': contentDisposition(download ? 'attachment' : 'inline', fileName),
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
