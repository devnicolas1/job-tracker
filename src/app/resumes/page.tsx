import { Download, ExternalLink, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { getServices } from '@/core/container';
import { RESUME_LANGUAGES } from '@/core/shared/schemas';
import { ScoreBadge } from '@/features/jobs/components/score-badge';
import { ResumeSlot } from '@/features/resumes/components/resume-slot';
import { buttonClasses } from '@/ui/button';
import { Card, CardHeader } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { PageHeader } from '@/ui/page-header';

export const metadata: Metadata = { title: 'Résumés' };

const LABELS = { en: 'English résumé', pt: 'Currículo em português' } as const;

export default function ResumesPage() {
  const { resumes, jobs } = getServices();
  const files = new Map(resumes.list().map((file) => [file.language, file]));
  const tailored = jobs.list({ limit: 500 }).filter((job) => job.hasTailoredResume);

  return (
    <>
      <PageHeader
        title="Résumés"
        description="Your own résumés are the basis of everything the agent tailors: each tailored version is your PDF with only its text adapted to the job."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {RESUME_LANGUAGES.map((language) => (
          <ResumeSlot
            key={language}
            language={language}
            label={LABELS[language]}
            file={files.get(language)}
          />
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader
          title="Tailored résumés"
          description="Rebuilt from your base résumé on demand, keeping its exact look."
        />
        {tailored.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={FileText} title="None yet">
              Strong matches found by the agent get a tailored résumé automatically.
            </EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tailored.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                <ScoreBadge score={job.assessment?.matchScore} />
                <div className="min-w-0 flex-1">
                  <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                    {job.title}
                  </Link>
                  <p className="text-sm text-muted">
                    {job.company}
                    {job.language && (
                      <span className="font-mono text-xs text-subtle uppercase">
                        {' '}
                        · {job.language}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/jobs/${job.id}/resume`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClasses({ size: 'sm' })}
                  >
                    <ExternalLink aria-hidden /> Open
                  </a>
                  <a
                    href={`/jobs/${job.id}/resume?download=1`}
                    className={buttonClasses({ size: 'sm' })}
                  >
                    <Download aria-hidden /> PDF
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
