import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import type { RawMentorTimeslot } from '@/lib/profile/scheduleHelpers';
import type { Reservation } from '@/types/reservation';

import { computeBookingAvailability } from './bookingAvailabilityModel';

describe('computeBookingAvailability', () => {
  // Use a fixed "now" of 2026-05-01 12:00:00 UTC (1777636800 seconds)
  const nowSec = 1777636800;

  // Occurrence times relative to nowSec:
  const pastTime = nowSec - 3600; // 1 hour ago
  const futureTime1 = nowSec + 3600; // 1 hour from now (2026-05-01 13:00)
  const futureTime2 = nowSec + 7200; // 2 hours from now (2026-05-01 14:00)

  it('handles a basic future ALLOW slot with no reservations or bookings', () => {
    const draftRows: RawMentorTimeslot[] = [
      {
        id: 1,
        type: 'ALLOW',
        dtstart: futureTime1,
        dtend: futureTime1 + 1800, // 30 mins
        rrule: undefined,
        exdate: [],
      },
    ];

    const model = computeBookingAvailability({
      draftRows,
      nowSec,
    });

    expect(model.allowedDates).toEqual(['2026-05-01']);
    expect(model.bookingStatusByDate.get('2026-05-01')).toBeUndefined();

    const slots = model.generateBookingSlots('2026-05-01', []);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({
      start: new Date(futureTime1 * 1000),
      end: new Date((futureTime1 + 1800) * 1000),
      scheduleId: 1,
      isBooked: false,
      status: null,
      menteeName: undefined,
      reservation: undefined,
    });
  });

  it('filters out past occurrences', () => {
    const draftRows: RawMentorTimeslot[] = [
      {
        id: 1,
        type: 'ALLOW',
        dtstart: pastTime,
        dtend: pastTime + 1800,
        rrule: undefined,
        exdate: [],
      },
    ];

    const model = computeBookingAvailability({
      draftRows,
      nowSec,
    });

    expect(model.allowedDates).toEqual([]);
    expect(model.generateBookingSlots('2026-05-01', [])).toEqual([]);
  });

  it('expands RRule and respects exdate exclusion', () => {
    const draftRows: RawMentorTimeslot[] = [
      {
        id: 1,
        type: 'ALLOW',
        dtstart: futureTime1, // week 1: 2026-05-01 13:00
        dtend: futureTime1 + 1800,
        rrule: 'FREQ=WEEKLY;COUNT=3', // occurs on 2026-05-01, 2026-05-08, 2026-05-15
        exdate: [futureTime1 + 86400 * 7], // exclude second occurrence (2026-05-08)
      },
    ];

    const model = computeBookingAvailability({
      draftRows,
      nowSec,
    });

    // 2026-05-08 should be excluded, leaving 05-01 and 05-15
    expect(model.allowedDates.sort()).toEqual(['2026-05-01', '2026-05-15']);

    const slotsWeek1 = model.generateBookingSlots('2026-05-01', []);
    expect(slotsWeek1).toHaveLength(1);
    expect(slotsWeek1[0].scheduleId).toBe(1);

    const slotsWeek2 = model.generateBookingSlots('2026-05-08', []);
    expect(slotsWeek2).toHaveLength(0);

    const slotsWeek3 = model.generateBookingSlots('2026-05-15', []);
    expect(slotsWeek3).toHaveLength(1);
  });

  it('handles BOOKED status correctly and respects includeBookedDates', () => {
    const draftRows: RawMentorTimeslot[] = [
      {
        id: 1,
        type: 'ALLOW',
        dtstart: futureTime1,
        dtend: futureTime1 + 1800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 2,
        type: 'BOOKED',
        dtstart: futureTime1,
        dtend: futureTime1 + 1800,
        rrule: undefined,
        exdate: [],
      },
    ];

    // Case 1: includeBookedDates is false (visitor/mentee view)
    const modelVisitor = computeBookingAvailability({
      draftRows,
      nowSec,
      includeBookedDates: false,
    });

    // Date has only booked slots, so it's not selectable for a visitor
    expect(modelVisitor.allowedDates).toEqual([]);
    expect(modelVisitor.bookingStatusByDate.get('2026-05-01')).toBe('BOOKED');

    const slotsVisitor = modelVisitor.generateBookingSlots('2026-05-01', []);
    expect(slotsVisitor).toHaveLength(1);
    expect(slotsVisitor[0].isBooked).toBe(true);
    expect(slotsVisitor[0].status).toBe('BOOKED');

    // Case 2: includeBookedDates is true (mentor view)
    const modelMentor = computeBookingAvailability({
      draftRows,
      nowSec,
      includeBookedDates: true,
    });

    // Date has booked slots, but mentor is viewing their own profile, so it should be allowed
    expect(modelMentor.allowedDates).toEqual(['2026-05-01']);
    expect(modelMentor.bookingStatusByDate.get('2026-05-01')).toBe('BOOKED');
  });

  it('handles PENDING status and BOOKED/PENDING precedence', () => {
    const draftRows: RawMentorTimeslot[] = [
      {
        id: 1,
        type: 'ALLOW',
        dtstart: futureTime1,
        dtend: futureTime1 + 1800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 2,
        type: 'PENDING',
        dtstart: futureTime1,
        dtend: futureTime1 + 1800,
        rrule: undefined,
        exdate: [],
      },
    ];

    const model = computeBookingAvailability({
      draftRows,
      nowSec,
      includeBookedDates: false,
    });

    // PENDING slots do not disable dates for visitors
    expect(model.allowedDates).toEqual(['2026-05-01']);
    expect(model.bookingStatusByDate.get('2026-05-01')).toBe('PENDING');

    const slots = model.generateBookingSlots('2026-05-01', []);
    expect(slots).toHaveLength(1);
    expect(slots[0].isBooked).toBe(false);
    expect(slots[0].status).toBe('PENDING');
  });

  it('gives priority to PENDING status when a date has both BOOKED and PENDING occurrences', () => {
    const draftRows: RawMentorTimeslot[] = [
      {
        id: 1,
        type: 'ALLOW',
        dtstart: futureTime1,
        dtend: futureTime1 + 1800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 2,
        type: 'BOOKED',
        dtstart: futureTime1,
        dtend: futureTime1 + 1800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 3,
        type: 'ALLOW',
        dtstart: futureTime2,
        dtend: futureTime2 + 1800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 4,
        type: 'PENDING',
        dtstart: futureTime2,
        dtend: futureTime2 + 1800,
        rrule: undefined,
        exdate: [],
      },
    ];

    const model = computeBookingAvailability({
      draftRows,
      nowSec,
      includeBookedDates: false,
    });

    // One slot is booked, one is pending. PENDING takes priority for the date status map overall.
    expect(model.bookingStatusByDate.get('2026-05-01')).toBe('PENDING');
  });

  it('matches reservations correctly', () => {
    const mockReservation = fromPartial<Reservation>({
      id: 'res-1',
      name: 'John Doe',
      dtstart: futureTime1,
      dtend: futureTime1 + 1800,
    });

    const draftRows: RawMentorTimeslot[] = [
      {
        id: 1,
        type: 'ALLOW',
        dtstart: futureTime1,
        dtend: futureTime1 + 1800,
        rrule: undefined,
        exdate: [],
      },
    ];

    const model = computeBookingAvailability({
      draftRows,
      nowSec,
    });

    const slots = model.generateBookingSlots('2026-05-01', [mockReservation]);
    expect(slots).toHaveLength(1);
    expect(slots[0].menteeName).toBe('John Doe');
    expect(slots[0].reservation).toEqual(mockReservation);
  });

  it('deduplicates overlapping occurrences', () => {
    const draftRows: RawMentorTimeslot[] = [
      {
        id: 1,
        type: 'ALLOW',
        dtstart: futureTime1,
        dtend: futureTime1 + 1800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 2,
        type: 'ALLOW',
        dtstart: futureTime1,
        dtend: futureTime1 + 1800,
        rrule: undefined,
        exdate: [],
      },
    ];

    const model = computeBookingAvailability({
      draftRows,
      nowSec,
    });

    const slots = model.generateBookingSlots('2026-05-01', []);
    expect(slots).toHaveLength(1);
  });
});
