import { describe, expect, it } from 'vitest';

import {
  checkCrossMonthOverlap,
  deduplicateBookingSlots,
  deduplicateRawSlots,
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

describe('checkCrossMonthOverlap', () => {
  it('correctly detects overlap in active rows across months', () => {
    const row1: RawMentorTimeslot = {
      id: 1,
      type: 'ALLOW',
      dtstart: 1785070000,
      dtend: 1785071800,
      rrule: undefined,
      exdate: [],
    };
    const currentDraftsMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', [row1]],
    ]);

    // Check if a new slot at the same time overlaps
    const hasOverlap = checkCrossMonthOverlap({
      id: 2,
      occurrenceUnix: 1785070000,
      newDtstart: 1785070500, // starts during row1
      durationSeconds: 1800,
      isRecurring: false,
      currentDraftsMap,
      targetDraft: [],
    });

    expect(hasOverlap).toBe(true);
  });
});

describe('deduplicateRawSlots', () => {
  it('correctly removes duplicate RawMentorTimeslots with the same id > 0', () => {
    const row1: RawMentorTimeslot = {
      id: 101,
      type: 'ALLOW',
      dtstart: 1000,
      dtend: 2000,
      rrule: 'FREQ=WEEKLY',
      exdate: [],
    };
    const row2: RawMentorTimeslot = {
      id: 101,
      type: 'ALLOW',
      dtstart: 1000,
      dtend: 2000,
      rrule: 'FREQ=WEEKLY',
      exdate: [1500], // slightly different exdate, simulating same slot loaded from different month cache
    };
    const row3: RawMentorTimeslot = {
      id: -1,
      type: 'ALLOW',
      dtstart: 3000,
      dtend: 4000,
      rrule: undefined,
      exdate: [],
    };

    const result = deduplicateRawSlots([row1, row2, row3]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(101);
    expect(result[1].id).toBe(-1);
  });
});

describe('deduplicateBookingSlots', () => {
  it('deduplicates BookingSlots with the same start time and merges isBooked status', () => {
    const slot1 = {
      start: new Date(1785070000 * 1000),
      end: new Date(1785071800 * 1000),
      scheduleId: 101,
      isBooked: false,
    };
    const slot2 = {
      start: new Date(1785070000 * 1000),
      end: new Date(1785071800 * 1000),
      scheduleId: 102,
      isBooked: true,
    };

    const result = deduplicateBookingSlots([slot1, slot2]);
    expect(result).toHaveLength(1);
    expect(result[0].isBooked).toBe(true);
    expect(result[0].scheduleId).toBe(101); // keeps the first encountered scheduleId
  });
});
