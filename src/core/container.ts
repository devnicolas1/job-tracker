import { getConfig, type AppConfig } from './config';
import { getDatabase, type AppDatabase } from './db/client';
import { createJobService, type JobService } from './jobs/service';
import { createProfileService, type ProfileService } from './profile/service';
import { createResumeService, type ResumeService } from './resumes/service';
import { createTailoredResumeService, type TailoredResumeService } from './tailoring/service';

/** Application services, wired once per process and shared by every adapter (web, MCP). */
export interface Services {
  readonly profiles: ProfileService;
  readonly resumes: ResumeService;
  readonly jobs: JobService;
  readonly tailoredResumes: TailoredResumeService;
}

export function createServices(db: AppDatabase, config: Pick<AppConfig, 'resumesDir'>): Services {
  const resumes = createResumeService(db, { directory: config.resumesDir });
  const tailoredResumes = createTailoredResumeService({ resumes });
  return {
    profiles: createProfileService(db),
    resumes,
    tailoredResumes,
    jobs: createJobService(db, { tailoring: tailoredResumes }),
  };
}

let services: Services | undefined;

export function getServices(): Services {
  services ??= createServices(getDatabase(), getConfig());
  return services;
}
