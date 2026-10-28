import fs from 'node:fs/promises';
import path from 'node:path';

import { eq } from 'drizzle-orm';

import type { AppDatabase } from '@/core/db/client';
import { resumes as resumesTable } from '@/core/db/schema';
import { layoutOf } from '@/core/resume-document/document';
import type { ResumeRow } from '@/core/db/schema';
import { NotFoundError, ValidationError } from '@/core/shared/errors';
import type { ResumeLanguage } from '@/core/shared/schemas';

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/** Base résumés are PDFs: tailored versions are rebuilt from their exact layout. */
const PDF = {
  extension: '.pdf',
  mimeType: 'application/pdf',
  signature: [0x25, 0x50, 0x44, 0x46],
} as const;

export const ACCEPTED_RESUME_TYPES = [PDF.mimeType];

export type ResumeFile = Omit<ResumeRow, 'storedName'>;

export interface ResumeUpload {
  readonly language: ResumeLanguage;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface StoredResume {
  readonly meta: ResumeFile;
  readonly absolutePath: string;
}

const isPdf = (bytes: Uint8Array) => PDF.signature.every((byte, index) => bytes[index] === byte);

function toResumeFile({ storedName: _storedName, ...meta }: ResumeRow): ResumeFile {
  return meta;
}

export function createResumeService(db: AppDatabase, options: { directory: string }) {
  const resolve = (storedName: string) => path.join(options.directory, storedName);

  function findRow(language: ResumeLanguage): ResumeRow | undefined {
    return db.select().from(resumesTable).where(eq(resumesTable.language, language)).get();
  }

  return {
    list(): ResumeFile[] {
      return db.select().from(resumesTable).all().map(toResumeFile);
    },

    get(language: ResumeLanguage): StoredResume | null {
      const row = findRow(language);
      return row ? { meta: toResumeFile(row), absolutePath: resolve(row.storedName) } : null;
    },

    async readBytes(language: ResumeLanguage): Promise<Uint8Array> {
      const row = findRow(language);
      if (!row) throw new NotFoundError('Résumé', language);
      return new Uint8Array(await fs.readFile(resolve(row.storedName)));
    },

    /** Stores (or replaces) the base résumé for a language. */
    async upload({ language, fileName, bytes }: ResumeUpload): Promise<ResumeFile> {
      if (bytes.byteLength === 0) throw new ValidationError('The file is empty.');
      if (bytes.byteLength > MAX_RESUME_BYTES) {
        throw new ValidationError('The file is larger than 5 MB.');
      }
      if (!isPdf(bytes)) throw new ValidationError('Upload your résumé as a PDF.');
      // Fails early for unreadable or scanned PDFs, which cannot be tailored.
      layoutOf(bytes);

      const storedName = `resume-${language}${PDF.extension}`;
      const previous = findRow(language);

      await fs.mkdir(options.directory, { recursive: true });
      // Write-then-rename keeps the old file intact if the process dies mid-write.
      const temporaryPath = `${resolve(storedName)}.uploading`;
      await fs.writeFile(temporaryPath, bytes);
      await fs.rename(temporaryPath, resolve(storedName));

      const values = {
        language,
        fileName: path.basename(fileName).slice(0, 255),
        storedName,
        mimeType: PDF.mimeType,
        sizeBytes: bytes.byteLength,
      };
      const row = db
        .insert(resumesTable)
        .values(values)
        .onConflictDoUpdate({
          target: resumesTable.language,
          set: { ...values, updatedAt: new Date() },
        })
        .returning()
        .get();

      if (previous && previous.storedName !== storedName) {
        await fs.rm(resolve(previous.storedName), { force: true });
      }
      return toResumeFile(row);
    },

    async remove(language: ResumeLanguage): Promise<void> {
      const row = findRow(language);
      if (!row) throw new NotFoundError('Résumé', language);
      db.delete(resumesTable).where(eq(resumesTable.language, language)).run();
      await fs.rm(resolve(row.storedName), { force: true });
    },
  };
}

export type ResumeService = ReturnType<typeof createResumeService>;
