import { describe, expect, it } from 'vitest';

import {
  checkCrossMonthOverlap,
  deduplicateBookingSlots,
  deduplicateRawSlots,
  findRestorableExdatedRow,
  isReadOnlyVirtualSlot,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';

describe('isReadOnlyVirtualSlot', () => {
  it('returns true for a negative-id BOOKED row', () => {
    expect(isReadOnlyVirtualSlot('BOOKED', -1)).toBe(true);
  });

  it('returns true for a negative-id PENDING row', () => {
    expect(isReadOnlyVirtualSlot('PENDING', -1)).toBe(true);
  });

  it('returns false for a positive-id BOOKED row (not the negative-id contract)', () => {
    expect(isReadOnlyVirtualSlot('BOOKED', 1)).toBe(false);
  });

  it('returns false for a negative-id ALLOW row (a local unsaved draft, not a placeholder)', () => {
    expect(isReadOnlyVirtualSlot('ALLOW', -1)).toBe(false);
  });

  it('returns false for a negative-id FORBIDDEN row', () => {
    expect(isReadOnlyVirtualSlot('FORBIDDEN', -1)).toBe(false);
  });
});

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

  it('correctly simulates exdate on parent row when isRecurring is true', () => {
    const row1: RawMentorTimeslot = {
      id: 101,
      type: 'ALLOW',
      dtstart: 1000,
      dtend: 1500, // duration 500
      rrule: 'FREQ=WEEKLY;COUNT=2', // occurrences at 1000, 605800 (1 week later)
      exdate: [],
    };
    const currentDraftsMap = new Map<string, RawMentorTimeslot[]>([
      ['1970-01', [row1]],
    ]);

    // Move occurrence at 1000 to 605850 (overlaps with the second occurrence at 605800)
    const hasOverlap = checkCrossMonthOverlap({
      id: 101,
      occurrenceUnix: 1000,
      newDtstart: 605850,
      durationSeconds: 500,
      isRecurring: true,
      currentDraftsMap,
      targetDraft: [],
    });
    expect(hasOverlap).toBe(true);

    // Move occurrence at 1000 to 1050. Since 1000 is exdated, 1050 does not overlap with the remaining occurrence at 605800
    const hasOverlapAt1050 = checkCrossMonthOverlap({
      id: 101,
      occurrenceUnix: 1000,
      newDtstart: 1050,
      durationSeconds: 500,
      isRecurring: true,
      currentDraftsMap,
      targetDraft: [],
    });
    expect(hasOverlapAt1050).toBe(false);
  });

  it('correctly utilizes targetDraft to detect overlap when target month is not loaded', () => {
    // Current loaded month is July (2026-07). August (2026-08) is NOT loaded.
    const row1: RawMentorTimeslot = {
      id: 1,
      type: 'ALLOW',
      dtstart: 1785070000, // July
      dtend: 1785071800,
      rrule: undefined,
      exdate: [],
    };
    const currentDraftsMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', [row1]],
    ]);

    // August has a cached/unloaded slot starting at August 2, 13:00 (1785675600)
    const targetDraftRow: RawMentorTimeslot = {
      id: 202,
      type: 'ALLOW',
      dtstart: 1785675600, // August 2, 13:00
      dtend: 1785677400, // +30 mins
      rrule: undefined,
      exdate: [],
    };

    // We check if a new slot at August 2, 13:15 (1785676500) overlaps.
    // Since August is not loaded, it should fall back to targetDraft and detect the overlap with targetDraftRow (slot 202).
    const hasOverlap = checkCrossMonthOverlap({
      id: 303,
      occurrenceUnix: 0,
      newDtstart: 1785676500, // August 2, 13:15
      durationSeconds: 1800,
      isRecurring: false,
      currentDraftsMap,
      targetDraft: [targetDraftRow], // pass the target month's draft explicitly
    });

    expect(hasOverlap).toBe(true);
  });
});

describe('deduplicateRawSlots', () => {
  it('correctly removes duplicate RawMentorTimeslots with the same id > 0 and merges exdate arrays via union', () => {
    const row1: RawMentorTimeslot = {
      id: 101,
      type: 'ALLOW',
      dtstart: 1000,
      dtend: 2000,
      rrule: 'FREQ=WEEKLY',
      exdate: [1200],
    };
    const row2: RawMentorTimeslot = {
      id: 101,
      type: 'ALLOW',
      dtstart: 1000,
      dtend: 2000,
      rrule: 'FREQ=WEEKLY',
      exdate: [1200, 1500], // overlapping exdate
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
    expect(result[0].exdate).toEqual([1200, 1500]); // Union of exdates
    expect(result[1].id).toBe(-1);
  });
});

describe('deduplicateBookingSlots', () => {
  it('deduplicates BookingSlots with the same start time and merges isBooked and status fields', () => {
    const slot1 = {
      start: new Date(1785070000 * 1000),
      end: new Date(1785071800 * 1000),
      scheduleId: 101,
      isBooked: false,
      status: 'PENDING' as const,
    };
    const slot2 = {
      start: new Date(1785070000 * 1000),
      end: new Date(1785071800 * 1000),
      scheduleId: 102,
      isBooked: true,
      status: 'BOOKED' as const,
    };

    const result = deduplicateBookingSlots([slot1, slot2]);
    expect(result).toHaveLength(1);
    expect(result[0].isBooked).toBe(true);
    expect(result[0].status).toBe('BOOKED');
    expect(result[0].scheduleId).toBe(101); // keeps the first encountered scheduleId
  });
});
