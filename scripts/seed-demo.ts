/**
 * Fills a throwaway data directory with a fictional profile and a few assessed jobs, to explore
 * the UI without touching real data. Run via `npm run demo`.
 */
import { getServices } from '@/core/container';

const { profiles, jobs } = getServices();

if (profiles.getProfile().basics) {
  console.log('Demo data already present.');
  process.exit(0);
}

profiles.updateBasics({
  fullName: 'Alex Morgan',
  headline: 'Senior Software Engineer',
  email: 'alex.morgan@example.com',
  location: 'Lisbon, Portugal',
  linkedin: 'https://www.linkedin.com/in/alex-morgan-demo/',
  github: 'https://github.com/alex-morgan-demo',
  summary:
    'Backend-leaning full-stack engineer with 8 years of experience building payment and logistics platforms in TypeScript and Go.',
});
profiles.updatePreferences({
  targetRoles: ['Senior Backend Engineer', 'Senior Full-Stack Engineer'],
  seniority: ['senior', 'staff'],
  workplaceTypes: ['remote'],
  locations: ['Portugal', 'Worldwide'],
  searchKeywords: ['TypeScript', 'Node.js'],
  excludeKeywords: ['PHP'],
});

profiles.saveEntry('experience', {
  company: 'Parcel Labs',
  title: 'Senior Software Engineer',
  location: 'Remote',
  employmentType: 'full-time',
  startDate: '2022-01',
  summary: 'Tech lead of the routing platform team (5 engineers).',
  highlights: [
    'Cut route computation p95 from 4.2s to 600ms by moving hot paths to a Go service',
    'Led the migration of 30 services from REST polling to an event-driven Kafka backbone',
  ],
  technologies: ['TypeScript', 'Node.js', 'Go', 'Kafka', 'PostgreSQL', 'AWS'],
});
profiles.saveEntry('experience', {
  company: 'Payflow',
  title: 'Software Engineer',
  startDate: '2018-03',
  endDate: '2021-12',
  highlights: ['Built the card-issuing API serving 2M requests/day', 'Introduced contract testing'],
  technologies: ['TypeScript', 'NestJS', 'PostgreSQL', 'Redis'],
});
profiles.saveEntry('education', {
  institution: 'University of Porto',
  degree: 'MSc',
  field: 'Informatics Engineering',
  startDate: '2013-09',
  endDate: '2018-02',
});
profiles.saveEntry('certification', {
  name: 'AWS Certified Solutions Architect – Associate',
  issuer: 'Amazon Web Services',
  issueDate: '2023-05',
});
for (const [name, category, level] of [
  ['TypeScript', 'language', 'expert'],
  ['Go', 'language', 'advanced'],
  ['Node.js', 'framework', 'expert'],
  ['PostgreSQL', 'database', 'advanced'],
  ['Kafka', 'tool', 'advanced'],
  ['AWS', 'cloud', 'advanced'],
] as const) {
  profiles.saveEntry('skill', { name, category, level });
}
profiles.saveEntry('language', { name: 'English', proficiency: 'C2' });
profiles.saveEntry('language', { name: 'Portuguese', proficiency: 'native' });

void jobs.save({
  source: 'linkedin',
  externalId: 'demo-1',
  url: 'https://www.linkedin.com/jobs/view/demo-1/',
  title: 'Senior Backend Engineer (TypeScript)',
  company: 'Northwind Logistics',
  location: 'Remote (EU)',
  workplaceType: 'remote',
  employmentType: 'full-time',
  seniority: 'Mid-Senior level',
  salary: '€70k – €85k',
  postedAt: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
  language: 'en',
  description:
    'We are looking for a senior backend engineer to scale our routing platform.\n\n- 5+ years with Node.js/TypeScript\n- Event-driven architectures (Kafka)\n- PostgreSQL at scale',
  assessment: {
    matchScore: 91,
    matchSummary:
      'Near-perfect overlap: routing domain, Kafka migration experience and TypeScript/Postgres depth match every must-have.',
    strengths: [
      'Same domain (routing/logistics)',
      'Led a Kafka migration',
      '8 years of TypeScript',
    ],
    gaps: ['No Kubernetes on the profile'],
  },
});
void jobs.save({
  source: 'linkedin',
  externalId: 'demo-2',
  url: 'https://www.linkedin.com/jobs/view/demo-2/',
  title: 'Desenvolvedor Full-Stack Sênior',
  company: 'Banco Atlântico',
  location: 'Porto, Portugal',
  workplaceType: 'hybrid',
  language: 'pt',
  assessment: {
    matchScore: 68,
    matchSummary: 'Good stack fit, but hybrid in Porto conflicts with the remote-only preference.',
    strengths: ['TypeScript and PostgreSQL', 'Payments background'],
    gaps: ['Hybrid, 3 days on-site', 'Angular experience requested'],
  },
});
void jobs.save({
  source: 'linkedin',
  externalId: 'demo-3',
  url: 'https://www.linkedin.com/jobs/view/demo-3/',
  title: 'Staff Platform Engineer',
  company: 'Cloudberry',
  location: 'Remote',
  workplaceType: 'remote',
  status: 'applied',
  assessment: {
    matchScore: 77,
    matchSummary:
      'Strong platform background; staff scope is a stretch but supported by tech-lead work.',
    strengths: ['Platform ownership', 'AWS certification'],
    gaps: ['No Terraform listed'],
  },
});

console.log('Demo data seeded.');
