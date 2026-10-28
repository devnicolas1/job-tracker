import { and, asc, eq, gt, lt, desc, max } from 'drizzle-orm';

import type { AppDatabase } from '@/core/db/client';
import { profile, profileEntries, type ProfileEntryRow } from '@/core/db/schema';
import { NotFoundError } from '@/core/shared/errors';
import { createId } from '@/core/shared/ids';
import { parseInput } from '@/core/shared/validation';

import {
  EMPTY_PREFERENCES,
  jobPreferencesSchema,
  PROFILE_SECTIONS,
  profileBasicsSchema,
  profileSectionSchemas,
  type JobPreferences,
  type Profile,
  type ProfileBasics,
  type ProfileEntries,
  type ProfileEntry,
  type ProfileSection,
  type SectionData,
} from './schemas';

const PROFILE_ROW_ID = 1;

export type MoveDirection = 'up' | 'down';

export function createProfileService(db: AppDatabase) {
  function toEntry(row: ProfileEntryRow): ProfileEntry {
    // Re-parsing on read applies defaults for fields added after the row was written.
    const data = profileSectionSchemas[row.section].parse(row.data);
    return { id: row.id, section: row.section, position: row.position, data };
  }

  function findEntryRow(id: string): ProfileEntryRow {
    const row = db.select().from(profileEntries).where(eq(profileEntries.id, id)).get();
    if (!row) throw new NotFoundError('Profile entry', id);
    return row;
  }

  function upsertProfileRow(values: { basics?: ProfileBasics; preferences?: JobPreferences }) {
    db.insert(profile)
      .values({ id: PROFILE_ROW_ID, ...values })
      .onConflictDoUpdate({ target: profile.id, set: { ...values, updatedAt: new Date() } })
      .run();
  }

  return {
    getProfile(): Profile {
      const row = db.select().from(profile).where(eq(profile.id, PROFILE_ROW_ID)).get();
      const rows = db
        .select()
        .from(profileEntries)
        .orderBy(asc(profileEntries.section), asc(profileEntries.position))
        .all();

      const entries = Object.fromEntries(
        PROFILE_SECTIONS.map((section) => [section, [] as ProfileEntry[]]),
      ) as Record<ProfileSection, ProfileEntry[]>;
      for (const entryRow of rows) entries[entryRow.section].push(toEntry(entryRow));

      return {
        basics: row?.basics ? profileBasicsSchema.parse(row.basics) : null,
        preferences: row?.preferences
          ? jobPreferencesSchema.parse(row.preferences)
          : EMPTY_PREFERENCES,
        entries: entries as ProfileEntries,
        updatedAt: row?.updatedAt ?? null,
      };
    },

    updateBasics(input: unknown): ProfileBasics {
      const basics = parseInput(profileBasicsSchema, input);
      upsertProfileRow({ basics });
      return basics;
    },

    updatePreferences(input: unknown): JobPreferences {
      const preferences = parseInput(jobPreferencesSchema, input);
      upsertProfileRow({ preferences });
      return preferences;
    },

    /** Creates an entry (appended to its section) or replaces the data of an existing one. */
    saveEntry<S extends ProfileSection>(section: S, input: unknown, id?: string): ProfileEntry<S> {
      // The registry lookup widens the type to the union of all sections; `S` narrows it back.
      const data = parseInput(profileSectionSchemas[section], input) as SectionData<S>;

      if (id) {
        const existing = findEntryRow(id);
        db.update(profileEntries).set({ data }).where(eq(profileEntries.id, id)).run();
        return { id, section, position: existing.position, data };
      }

      const last = db
        .select({ value: max(profileEntries.position) })
        .from(profileEntries)
        .where(eq(profileEntries.section, section))
        .get();
      const entry = { id: createId(), section, position: (last?.value ?? -1) + 1, data };
      db.insert(profileEntries).values(entry).run();
      return entry;
    },

    deleteEntry(id: string): void {
      const { changes } = db.delete(profileEntries).where(eq(profileEntries.id, id)).run();
      if (changes === 0) throw new NotFoundError('Profile entry', id);
    },

    /** Swaps an entry with its neighbour, so users can order entries by relevance. */
    moveEntry(id: string, direction: MoveDirection): void {
      db.transaction((tx) => {
        const current = findEntryRow(id);
        const neighbour = tx
          .select()
          .from(profileEntries)
          .where(
            and(
              eq(profileEntries.section, current.section),
              direction === 'up'
                ? lt(profileEntries.position, current.position)
                : gt(profileEntries.position, current.position),
            ),
          )
          .orderBy(
            direction === 'up' ? desc(profileEntries.position) : asc(profileEntries.position),
          )
          .limit(1)
          .get();
        if (!neighbour) return;

        tx.update(profileEntries)
          .set({ position: neighbour.position })
          .where(eq(profileEntries.id, current.id))
          .run();
        tx.update(profileEntries)
          .set({ position: current.position })
          .where(eq(profileEntries.id, neighbour.id))
          .run();
      });
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
