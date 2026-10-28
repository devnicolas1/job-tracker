import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createServices, type Services } from '@/core/container';
import { openDatabase } from '@/core/db/client';
import type { SaveJobInput } from '@/core/jobs/schemas';
import type { Paragraph, ResumeLayout, TextStyle } from '@/core/resume-document/model';
import { renderLayout } from '@/core/resume-document/render';
import type { ResumeLanguage } from '@/core/shared/schemas';

/** Fresh services over an in-memory database with the real migrations applied. */
export function createTestServices(): Services {
  const db = openDatabase({
    file: ':memory:',
    migrationsDir: path.resolve(import.meta.dirname, '../../../drizzle'),
  });
  const resumesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-tracker-test-'));
  return createServices(db, { resumesDir });
}

/** Seeds a small but complete profile and returns the ids of its entries. */
export function seedProfile({ profiles }: Services) {
  profiles.updateBasics({
    fullName: 'Ana Souza',
    email: 'ana@example.com',
    location: 'São Paulo, Brazil',
    linkedin: 'https://www.linkedin.com/in/ana-souza/',
  });
  const current = profiles.saveEntry('experience', {
    company: 'Globex',
    title: 'Senior Software Engineer',
    startDate: '2022-03',
    highlights: ['Led the payments rewrite'],
  });
  const previous = profiles.saveEntry('experience', {
    company: 'Initech',
    title: 'Software Engineer',
    startDate: '2019-01',
    endDate: '2022-02',
  });
  const degree = profiles.saveEntry('education', {
    institution: 'UFPR',
    degree: 'BSc',
    field: 'Computer Science',
    endDate: '2018-12',
  });
  profiles.saveEntry('language', { name: 'English', proficiency: 'C1' });
  return { current, previous, degree };
}

export const samplePosting = {
  source: 'linkedin',
  externalId: '4000000001',
  url: 'https://www.linkedin.com/jobs/view/4000000001/',
  title: 'Senior TypeScript Engineer',
  company: 'Acme',
} as const satisfies SaveJobInput;

const regular: TextStyle = {
  font: { family: 'Calibri', bold: false, italic: false },
  size: 10.5,
  color: '#000000',
};
const bold: TextStyle = { ...regular, font: { ...regular.font, bold: true } };
const heading: TextStyle = { ...bold, size: 11.5, color: '#1f3a5f' };

const block = {
  left: 50,
  right: 545,
  align: 'left',
  lineHeight: 12.8,
  spaceBefore: 15.3,
  rules: [],
} as const;
const bullet = (id: string, lead: string, text: string): Paragraph => ({
  ...block,
  id,
  left: 68,
  marker: { text: '•', x: 56, style: regular },
  runs: [
    { ...bold, text: `${lead} ` },
    { ...regular, text },
  ],
});

/** A small résumé in the shape of a real one: name, ruled heading, justified text, bullets. */
export const sampleResumeLayout: ResumeLayout = {
  pageWidth: 596,
  pageHeight: 842,
  firstBaseline: 62,
  lastBaseline: 787,
  pageBackground: '#ffffff',
  paragraphs: [
    {
      ...block,
      id: 'p1',
      align: 'center',
      lineHeight: 24.4,
      spaceBefore: 0,
      runs: [{ ...heading, size: 20, text: 'ANA SOUZA' }],
    },
    {
      ...block,
      id: 'p2',
      lineHeight: 14,
      spaceBefore: 40,
      runs: [{ ...heading, text: 'EXPERIENCE' }],
      rules: [{ x1: 50, x2: 545, offset: 5.5, thickness: 1.33, color: '#1f3a5f' }],
    },
    {
      ...block,
      id: 'p3',
      align: 'justify',
      spaceBefore: 21,
      runs: [
        {
          ...regular,
          text:
            'Backend developer with years of experience building billing, CRM integrations and ' +
            'cloud provisioning systems with PHP and Python on Google Cloud Platform and ' +
            'Kubernetes, with a strong focus on automated testing and continuous delivery.',
        },
      ],
    },
    bullet('p4', 'Billing:', 'led the migration of the billing platform to a multi-company model.'),
    bullet('p5', 'CI/CD:', 'standardised pipelines for three projects.'),
  ],
};

/** Uploads a PDF rendered from {@link sampleResumeLayout} as the base résumé for `language`. */
export async function seedBaseResume({ resumes }: Services, language: ResumeLanguage = 'en') {
  const bytes = new Uint8Array(await renderLayout(sampleResumeLayout));
  return resumes.upload({ language, fileName: `Ana Souza CV ${language}.pdf`, bytes });
}
