import { describe, expect, it } from 'vitest';

import {
  findRestorableExdatedRow,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';

describe('findRestorableExdatedRow', () => {
  const recurringRow: RawMentorTimeslot = {
    id: 101,
    type: 'ALLOW',
    dtstart: 1774390000, // week 1
    dtend: 1774391800, // +30 min
    rrule: 'FREQ=WEEKLY;COUNT=4',
    exdate: [1774994800], // week 2 deleted
  };

  it('finds the row when re-adding a previously deleted occurrence with matching duration', () => {
    const result = findRestorableExdatedRow([recurringRow], 1774994800, 1800);
    expect(result?.id).toBe(101);
  });

  it('returns null when the occurrence is not in any row exdate', () => {
    const result = findRestorableExdatedRow(
      [recurringRow],
      1774390000, // still active, never deleted
      1800
    );
    expect(result).toBeNull();
  });

  it('returns null when the duration does not match', () => {
    const result = findRestorableExdatedRow(
      [recurringRow],
      1774994800,
      2700 // 45 min instead of 30 min
    );
    expect(result).toBeNull();
  });

  it('returns null for a non-recurring row even if the timestamp matches', () => {
    const nonRecurringRow: RawMentorTimeslot = {
      id: 102,
      type: 'ALLOW',
      dtstart: 1774994800,
      dtend: 1774996600,
      rrule: undefined,
      exdate: [1774994800],
    };
    const result = findRestorableExdatedRow(
      [nonRecurringRow],
      1774994800,
      1800
    );
    expect(result).toBeNull();
  });

  it('returns null when the row type is not ALLOW', () => {
    const bookedRow: RawMentorTimeslot = {
      ...recurringRow,
      type: 'BOOKED',
    };
    const result = findRestorableExdatedRow([bookedRow], 1774994800, 1800);
    expect(result).toBeNull();
  });

  it('returns null when the occurrence would not actually be produced by the rrule', () => {
    const rowWithUnrelatedExdate: RawMentorTimeslot = {
      ...recurringRow,
      exdate: [1774994800 + 3600], // an exdate value the rrule never produces
    };
    const result = findRestorableExdatedRow(
      [rowWithUnrelatedExdate],
      1774994800 + 3600,
      1800
    );
    expect(result).toBeNull();
  });
});
