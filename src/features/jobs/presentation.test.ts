import { describe, expect, it } from 'vitest';

import { groupByDayAdded } from './presentation';

const now = new Date(2026, 9, 28, 15, 0);
const job = (id: string, createdAt: Date, matchScore?: number) => ({
  id,
  createdAt,
  assessment:
    matchScore === undefined ? null : { matchScore, matchSummary: '', strengths: [], gaps: [] },
});

describe('groupByDayAdded', () => {
  it('groups by local day added, newest day first and best match first within a day', () => {
    const groups = groupByDayAdded(
      [
        job('a', new Date(2026, 9, 28, 9, 0), 60),
        job('b', new Date(2026, 9, 28, 0, 5)),
        job('c', new Date(2026, 9, 28, 0, 1), 90),
        job('d', new Date(2026, 9, 27, 23, 59), 70),
        job('e', new Date(2026, 9, 20, 12, 0), 50),
        job('f', new Date(2025, 11, 31, 12, 0), 50),
      ],
      now,
    );

    expect(groups.map((group) => [group.label, group.jobs.map((member) => member.id)])).toEqual([
      ['Today', ['c', 'a', 'b']],
      ['Yesterday', ['d']],
      ['Tuesday, Oct 20', ['e']],
      ['Wednesday, Dec 31, 2025', ['f']],
    ]);
  });
});
