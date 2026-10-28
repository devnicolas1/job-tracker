import { beforeEach, describe, expect, it } from 'vitest';

import type { Services } from '@/core/container';
import { NotFoundError, ValidationError } from '@/core/shared/errors';
import { createTestServices } from '@/core/testing/fixtures';

describe('profile service', () => {
  let services: Services;
  beforeEach(() => {
    services = createTestServices();
  });

  it('starts empty', () => {
    const profile = services.profiles.getProfile();
    expect(profile.basics).toBeNull();
    expect(profile.entries.experience).toEqual([]);
    expect(profile.preferences.targetRoles).toEqual([]);
  });

  it('creates, updates and appends entries in order', () => {
    const { profiles } = services;
    const first = profiles.saveEntry('skill', { name: 'TypeScript', category: 'language' });
    const second = profiles.saveEntry('skill', { name: 'PostgreSQL', category: 'database' });
    profiles.saveEntry(
      'skill',
      { name: 'TypeScript', category: 'language', level: 'expert' },
      first.id,
    );

    const skills = profiles.getProfile().entries.skill;
    expect(skills.map((entry) => entry.id)).toEqual([first.id, second.id]);
    expect(skills[0]?.data).toMatchObject({ level: 'expert' });
  });

  it('rejects invalid data with field-level errors', () => {
    expect(() =>
      services.profiles.saveEntry('experience', {
        company: 'Acme',
        title: 'Engineer',
        startDate: '2024-05',
        endDate: '2023-01',
      }),
    ).toThrow(ValidationError);

    try {
      services.profiles.saveEntry('certification', { name: '', issuer: 'AWS', url: 'nope' });
    } catch (error) {
      expect((error as ValidationError).fieldErrors).toHaveProperty('url');
      expect((error as ValidationError).fieldErrors).toHaveProperty('name');
    }
  });

  it('moves entries within their section only', () => {
    const { profiles } = services;
    const a = profiles.saveEntry('language', { name: 'Portuguese', proficiency: 'native' });
    const b = profiles.saveEntry('language', { name: 'English', proficiency: 'C1' });
    profiles.saveEntry('skill', { name: 'Go', category: 'language' });

    profiles.moveEntry(b.id, 'up');
    profiles.moveEntry(b.id, 'up'); // already first: no-op

    expect(profiles.getProfile().entries.language.map((entry) => entry.id)).toEqual([b.id, a.id]);
  });

  it('reports missing entries', () => {
    expect(() => {
      services.profiles.deleteEntry('missing');
    }).toThrow(NotFoundError);
  });
});
