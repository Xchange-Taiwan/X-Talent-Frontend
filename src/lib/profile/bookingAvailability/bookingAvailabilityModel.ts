import dayjs from 'dayjs';

import {
  deduplicateBookingSlots,
  expandRrule,
  findMatchedReservation,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import type { Reservation } from '@/types/reservation';

import { BookingSlot, BookingStatus } from './types';

export interface BookingAvailabilityParams {
  draftRows: RawMentorTimeslot[];
  nowSec: number;
  includeBookedDates?: boolean;
}

export interface BookingAvailabilityModel {
  allowedDates: string[];
  bookingStatusByDate: Map<string, BookingStatus>;
  generateBookingSlots: (
    dateKey: string,
    currentReservations?: Reservation[]
  ) => BookingSlot[];
}

/**
 * Computes the complete booking availability calendar view (read model).
 * Takes active timeslot rows, current time, and a view intent,
 * and derives allowedDates, booking statuses per date, and a generator for selected date slots.
 */
export function computeBookingAvailability({
  draftRows,
  nowSec,
  includeBookedDates = false,
}: BookingAvailabilityParams): BookingAvailabilityModel {
  // 1. Resolve booked & pending dtstarts for checking slot and calendar statuses
  const bookedStarts = new Set<number>();
  const pendingStarts = new Set<number>();
  for (const s of draftRows) {
    if (s.type === 'BOOKED') bookedStarts.add(s.dtstart);
    else if (s.type === 'PENDING') pendingStarts.add(s.dtstart);
  }

  // 2. Expand future ALLOW occurrences, excluding exdates and past occurrences
  const futureAllowOccurrences: { occ: number; dateKey: string }[] = [];
  for (const slot of draftRows) {
    if (slot.type !== 'ALLOW') continue;
    const occurrences = expandRrule(slot.dtstart, slot.rrule);
    for (const occ of occurrences) {
      if (slot.exdate.includes(occ)) continue;
      if (occ <= nowSec) continue;
      futureAllowOccurrences.push({
        occ,
        dateKey: dayjs(occ * 1000).format('YYYY-MM-DD'),
      });
    }
  }

  // 3. Determine allowedDates: dates with at least one future selectable/viewable occurrence
  const allowedDatesSet = new Set<string>();
  for (const { occ, dateKey } of futureAllowOccurrences) {
    if (
      !includeBookedDates &&
      (bookedStarts.has(occ) || pendingStarts.has(occ))
    )
      continue;
    allowedDatesSet.add(dateKey);
  }
  const allowedDates = Array.from(allowedDatesSet);

  // 4. Precompute per-day booking status for status dots
  const datesWithPending = new Set<string>();
  const datesWithBooked = new Set<string>();

  for (const { occ, dateKey } of futureAllowOccurrences) {
    if (bookedStarts.has(occ)) {
      datesWithBooked.add(dateKey);
    } else if (pendingStarts.has(occ)) {
      datesWithPending.add(dateKey);
    }
  }

  const bookingStatusByDate = new Map<string, BookingStatus>();
  datesWithBooked.forEach((dateKey) =>
    bookingStatusByDate.set(dateKey, 'BOOKED')
  );
  // PENDING takes priority over BOOKED for the same date
  datesWithPending.forEach((dateKey) =>
    bookingStatusByDate.set(dateKey, 'PENDING')
  );

  // 5. Generate slots for a specific selected date
  const generateBookingSlots = (
    dateKey: string,
    currentReservations?: Reservation[]
  ): BookingSlot[] => {
    const result: BookingSlot[] = [];

    for (const slot of draftRows) {
      if (slot.type !== 'ALLOW') continue;

      const occurrences = expandRrule(slot.dtstart, slot.rrule);
      const slotDuration = slot.dtend - slot.dtstart;

      for (const occ of occurrences) {
        if (slot.exdate.includes(occ)) continue;
        if (occ <= nowSec) continue;
        if (dayjs(occ * 1000).format('YYYY-MM-DD') !== dateKey) continue;

        const slotStart = occ;
        const slotEnd = occ + slotDuration;
        const matchedRes = findMatchedReservation(
          currentReservations,
          slotStart,
          slotEnd
        );

        const isBooked = bookedStarts.has(occ);
        const status = isBooked
          ? ('BOOKED' as const)
          : pendingStarts.has(occ)
            ? ('PENDING' as const)
            : null;

        result.push({
          start: new Date(occ * 1000),
          end: new Date((occ + slotDuration) * 1000),
          scheduleId: slot.id,
          isBooked,
          status,
          menteeName: matchedRes?.name,
          reservation: matchedRes,
        });
      }
    }

    return deduplicateBookingSlots(result);
  };

  return {
    allowedDates,
    bookingStatusByDate,
    generateBookingSlots,
  };
}
