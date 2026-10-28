import {
  ArrowLeft,
  Building2,
  CircleCheck,
  CircleAlert,
  Download,
  ExternalLink,
  FileText,
  MapPin,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getServices } from '@/core/container';
import type { Job } from '@/core/jobs/schemas';
import { NotFoundError } from '@/core/shared/errors';
import { CopyPromptButton } from '@/features/jobs/components/copy-prompt-button';
import { DeleteJobButton } from '@/features/jobs/components/delete-job-button';
import { NotesForm } from '@/features/jobs/components/notes-form';
import { ScoreBadge } from '@/features/jobs/components/score-badge';
import { StatusSelect } from '@/features/jobs/components/status-select';
import { tailoringPrompt } from '@/features/jobs/tailoring-prompt';
import { formatRelative, humanize } from '@/lib/format';
import { buttonClasses } from '@/ui/button';
import { Card, CardBody, CardHeader } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';

interface Props {
  params: Promise<{ id: string }>;
}

function findJob(id: string): Job {
  try {
    return getServices().jobs.get(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = findJob((await params).id);
  return { title: `${job.title} — ${job.company}` };
}

const LANGUAGE_NAMES = { en: 'English', pt: 'Portuguese' } as const;

export default async function JobPage({ params }: Props) {
  const job = findJob((await params).id);
  const resumeUrl = `/jobs/${job.id}/resume`;
  const prompt = tailoringPrompt(job.id);
  const resumeStatus =
    job.tailoredResume && (await getServices().tailoredResumes.status(job.tailoredResume));

  const details: [string, string | undefined][] = [
    ['Source', humanize(job.source)],
    ['Seniority', job.seniority],
    ['Employment', job.employmentType && humanize(job.employmentType)],
    ['Workplace', job.workplaceType && humanize(job.workplaceType)],
    ['Salary', job.salary],
    ['Language', job.language && LANGUAGE_NAMES[job.language]],
    ['Posted', job.postedAt && formatRelative(job.postedAt)],
    ['Found', formatRelative(job.createdAt)],
    ['Status changed', formatRelative(job.statusChangedAt)],
  ];

  return (
    <>
      <Link
        href="/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> All jobs
      </Link>

      <header className="mb-6 flex flex-wrap items-start gap-4">
        <ScoreBadge score={job.assessment?.matchScore} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
            <span className="flex items-center gap-1.5">
              <Building2 className="size-4" aria-hidden /> {job.company}
            </span>
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden /> {job.location}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusSelect jobId={job.id} status={job.status} />
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses({ variant: 'primary', size: 'sm' })}
          >
            View posting <ExternalLink aria-hidden />
          </a>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {job.assessment && (
            <Card>
              <CardHeader title="Fit analysis" />
              <CardBody className="flex flex-col gap-5">
                <p className="leading-relaxed">{job.assessment.matchSummary}</p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <InsightList title="Strengths" items={job.assessment.strengths} tone="success" />
                  <InsightList title="Gaps" items={job.assessment.gaps} tone="warning" />
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Tailored résumé"
              description={
                resumeStatus === 'ready'
                  ? 'Your résumé, with its text adapted to this posting.'
                  : undefined
              }
              actions={
                resumeStatus === 'ready' && (
                  <>
                    <CopyPromptButton prompt={prompt} label="Re-tailor" variant="ghost" />
                    <a
                      href={resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClasses({ size: 'sm' })}
                    >
                      <ExternalLink aria-hidden /> Open
                    </a>
                    <a
                      href={`${resumeUrl}?download=1`}
                      className={buttonClasses({ size: 'sm', variant: 'primary' })}
                    >
                      <Download aria-hidden /> Download PDF
                    </a>
                  </>
                )
              }
            />
            <CardBody>
              {resumeStatus === 'ready' ? (
                <iframe
                  src={resumeUrl}
                  title={`Tailored résumé for ${job.title}`}
                  className="aspect-[1/1.414] w-full rounded-lg border border-border bg-white"
                />
              ) : resumeStatus ? (
                <EmptyState
                  icon={CircleAlert}
                  title="Tailored résumé is out of date"
                  action={
                    <CopyPromptButton
                      prompt={prompt}
                      label="Copy tailoring prompt"
                      variant="primary"
                    />
                  }
                >
                  {resumeStatus === 'base-missing'
                    ? 'The base résumé it was made from was removed.'
                    : 'Your base résumé was replaced after this was tailored, so its edits no longer line up.'}{' '}
                  Copy the prompt and paste it into Claude Code or Codex, in this project, to tailor
                  it again.
                </EmptyState>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No tailored résumé"
                  action={
                    <CopyPromptButton
                      prompt={prompt}
                      label="Copy tailoring prompt"
                      variant="primary"
                    />
                  }
                >
                  The agent writes one for strong matches. To get one for this job, copy the prompt
                  and paste it into Claude Code or Codex, in this project.
                </EmptyState>
              )}
            </CardBody>
          </Card>

          {job.description && (
            <Card>
              <CardHeader title="Job description" />
              <CardBody>
                <div className="max-w-prose leading-relaxed whitespace-pre-line text-muted">
                  {job.description}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {details
                  .filter((entry): entry is [string, string] => Boolean(entry[1]))
                  .map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-subtle">{label}</dt>
                      <dd className="text-right">{value}</dd>
                    </div>
                  ))}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              <NotesForm jobId={job.id} notes={job.notes} />
            </CardBody>
          </Card>
          <div className="flex justify-end">
            <DeleteJobButton jobId={job.id} />
          </div>
        </aside>
      </div>
    </>
  );
}

function InsightList({
  title,
  items,
  tone,
}: {
  title: string;
  items: readonly string[];
  tone: 'success' | 'warning';
}) {
  if (items.length === 0) return null;
  const Icon = tone === 'success' ? CircleCheck : CircleAlert;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Icon
              className={
                tone === 'success'
                  ? 'mt-0.5 size-4 shrink-0 text-success'
                  : 'mt-0.5 size-4 shrink-0 text-warning'
              }
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
