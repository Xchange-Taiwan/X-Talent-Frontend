import dayjs from 'dayjs';

import {
  deduplicateBookingSlots,
  expandRrule,
  findMatchedReservation,
  formatTimeslot,
  isReadOnlyVirtualSlot,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import type { Reservation } from '@/types/reservation';

import {
  BookingSlot,
  BookingStatus,
  EditorSlotWithMeta,
  ParsedMentorTimeslot,
} from './types';

export interface BookingAvailabilityParams {
  draftRows: RawMentorTimeslot[];
  nowSec: number;
  includeBookedDates?: boolean;
  selectedDate?: string | null;
  reservations?: Reservation[];
}

export interface BookingAvailabilityModel {
  allowedDates: string[];
  availableDates: string[];
  bookedDates: string[];
  earliestSelectableDate: string | null;
  slotsForSelectedDate: BookingSlot[];
  slotsWithMeta: EditorSlotWithMeta[];
  futureSlots: ParsedMentorTimeslot[];
  bookingStatusByDate: Map<string, BookingStatus>;
  generateBookingSlots: (
    dateKey: string,
    currentReservations?: Reservation[]
  ) => BookingSlot[];
  projectEditorSlots: (
    dateKey: string | null,
    currentReservations?: Reservation[]
  ) => {
    slotsWithMeta: EditorSlotWithMeta[];
    futureSlots: ParsedMentorTimeslot[];
  };
}

/**
 * Projects a single day's parsed occurrences (including virtual BOOKED/PENDING
 * placeholders for deleted schedule rules) with reservation matching and past-slot
 * metadata for MentorScheduleDialog.
 */
export function projectEditorOccurrences(
  draftForSelectedDate: ParsedMentorTimeslot[],
  reservations: Reservation[] | undefined,
  nowSec: number
): {
  slotsWithMeta: EditorSlotWithMeta[];
  futureSlots: ParsedMentorTimeslot[];
} {
  const bookedStarts = new Set<number>();
  const pendingStarts = new Set<number>();

  for (const s of draftForSelectedDate) {
    if (!isReadOnlyVirtualSlot(s.type, s.id)) continue;
    const startSec = Math.floor(s.start.getTime() / 1000);
    if (s.type === 'BOOKED') bookedStarts.add(startSec);
    else if (s.type === 'PENDING') pendingStarts.add(startSec);
  }

  const allowSlots = draftForSelectedDate.filter((s) => s.type === 'ALLOW');
  const allowStarts = new Set(
    allowSlots.map((s) => Math.floor(s.start.getTime() / 1000))
  );

  // Include virtual BOOKED/PENDING slots whose underlying ALLOW schedule rule
  // was deleted so the mentor editor still surfaces the active reservation block.
  const orphanVirtualSlots = draftForSelectedDate.filter((s) => {
    if (!isReadOnlyVirtualSlot(s.type, s.id)) return false;
    const startSec = Math.floor(s.start.getTime() / 1000);
    return !allowStarts.has(startSec);
  });

  const combinedSlots = [...allowSlots, ...orphanVirtualSlots].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  const slotsWithMeta: EditorSlotWithMeta[] = combinedSlots.map((slot) => {
    const slotStart = Math.floor(slot.start.getTime() / 1000);
    const slotEnd = Math.floor(slot.end.getTime() / 1000);
    const reservationBlock: 'BOOKED' | 'PENDING' | null =
      slot.type === 'BOOKED' || bookedStarts.has(slotStart)
        ? 'BOOKED'
        : slot.type === 'PENDING' || pendingStarts.has(slotStart)
          ? 'PENDING'
          : null;
    const matchedReservation = findMatchedReservation(
      reservations,
      slotStart,
      slotEnd
    );
    return {
      slot,
      isPast: slotStart <= nowSec,
      reservationBlock,
      matchedReservation,
    };
  });

  const futureSlots = allowSlots.filter(
    (s) => Math.floor(s.start.getTime() / 1000) > nowSec
  );

  return { slotsWithMeta, futureSlots };
}

/**
 * Computes the complete booking availability calendar view (read model).
 * Takes active timeslot rows, current time, and a view intent,
 * and derives allowedDates, availableDates, bookedDates, earliestSelectableDate,
 * booking statuses per date, viewer slots, and editor slotsWithMeta.
 */
export function computeBookingAvailability({
  draftRows,
  nowSec,
  includeBookedDates = false,
  selectedDate = null,
  reservations = [],
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

  // 3. Determine availableDates, bookedDates, and allowedDates
  const availableDatesSet = new Set<string>();
  const bookedDatesSet = new Set<string>();
  const allowedDatesSet = new Set<string>();

  for (const { occ, dateKey } of futureAllowOccurrences) {
    const isTaken = bookedStarts.has(occ) || pendingStarts.has(occ);
    if (isTaken) {
      bookedDatesSet.add(dateKey);
    } else {
      availableDatesSet.add(dateKey);
    }
    if (!includeBookedDates && isTaken) continue;
    allowedDatesSet.add(dateKey);
  }

  // Also include dates from standalone future virtual BOOKED/PENDING rows in bookedDates
  for (const s of draftRows) {
    if ((s.type === 'BOOKED' || s.type === 'PENDING') && s.dtstart > nowSec) {
      bookedDatesSet.add(dayjs(s.dtstart * 1000).format('YYYY-MM-DD'));
    }
  }

  const availableDates = Array.from(availableDatesSet).sort();
  const bookedDates = Array.from(bookedDatesSet).sort();
  const allowedDates = Array.from(allowedDatesSet);
  const earliestSelectableDate = [...allowedDates].sort()[0] ?? null;

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

  // 6. Editor occurrence projection (including virtual slots)
  const parsedAll = (() => {
    const formatted = draftRows.flatMap(formatTimeslot);
    const seen = new Set<string>();
    const out: ParsedMentorTimeslot[] = [];
    for (const slot of formatted) {
      if (!seen.has(slot.occurrenceId)) {
        seen.add(slot.occurrenceId);
        out.push(slot);
      }
    }
    return out.sort((a, b) => a.start.getTime() - b.start.getTime());
  })();

  const projectEditorSlots = (
    dateKey: string | null,
    currentReservations: Reservation[] | undefined = reservations
  ) => {
    const forDate = dateKey
      ? parsedAll.filter((p) => p.dateKey === dateKey)
      : [];
    return projectEditorOccurrences(forDate, currentReservations, nowSec);
  };

  const slotsForSelectedDate = selectedDate
    ? generateBookingSlots(selectedDate, reservations)
    : [];
  const { slotsWithMeta, futureSlots } = projectEditorSlots(
    selectedDate,
    reservations
  );

  return {
    allowedDates,
    availableDates,
    bookedDates,
    earliestSelectableDate,
    slotsForSelectedDate,
    slotsWithMeta,
    futureSlots,
    bookingStatusByDate,
    generateBookingSlots,
    projectEditorSlots,
  };
}
