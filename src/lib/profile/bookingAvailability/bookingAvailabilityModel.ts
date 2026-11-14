import dayjs from 'dayjs';

import {
  deduplicateBookingSlots,
  expandRrule,
  findMatchedReservation,
  isReadOnlyVirtualSlot,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import type { Reservation } from '@/types/reservation';

import type {
  BookingSlot,
  BookingStatus,
  EditorSlotWithMeta,
  ParsedMentorTimeslot,
} from './types';

export interface ComputeBookingAvailabilityParams {
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
  parsedOccurrences: ParsedMentorTimeslot[];
  bookingStatusByDate: Map<string, BookingStatus>;
  getOccurrencesForDate: (dateKey: string) => ParsedMentorTimeslot[];
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
 * Pure projection of a selected date's parsed occurrences into editor display items
 * (`slotsWithMeta`) and future ALLOW occurrences (`futureSlots`).
 * Handles both normal ALLOW slots overlaid by virtual BOOKED/PENDING rows AND
 * standalone orphan virtual BOOKED/PENDING rows (e.g. when the underlying
 * schedule rule was deleted).
 */
export function projectEditorOccurrences(
  occurrencesForDate: ParsedMentorTimeslot[],
  reservations: Reservation[] | undefined,
  nowSec: number
): {
  slotsWithMeta: EditorSlotWithMeta[];
  futureSlots: ParsedMentorTimeslot[];
} {
  const virtualByStart = new Map<
    number,
    { slot: ParsedMentorTimeslot; blockType: BookingStatus }
  >();
  for (const s of occurrencesForDate) {
    if (
      isReadOnlyVirtualSlot(s.type, s.id) &&
      (s.type === 'BOOKED' || s.type === 'PENDING')
    ) {
      const existing = virtualByStart.get(s.occurrenceUnix);
      if (!existing || s.type === 'BOOKED') {
        virtualByStart.set(s.occurrenceUnix, { slot: s, blockType: s.type });
      }
    }
  }

  const allowSlots = occurrencesForDate.filter((s) => s.type === 'ALLOW');
  const coveredStarts = new Set<number>();

  const allowItems: EditorSlotWithMeta[] = allowSlots.map((slot) => {
    coveredStarts.add(slot.occurrenceUnix);
    const slotStart = Math.floor(slot.start.getTime() / 1000);
    const slotEnd = Math.floor(slot.end.getTime() / 1000);
    const isPast = slotStart <= nowSec;
    const virtual = virtualByStart.get(slot.occurrenceUnix);
    const reservationBlock = virtual?.blockType ?? null;
    const matchedReservation = reservationBlock
      ? findMatchedReservation(reservations, slotStart, slotEnd)
      : undefined;
    return { slot, isPast, reservationBlock, matchedReservation };
  });

  // Include standalone virtual BOOKED/PENDING occurrences that have no backing ALLOW row
  // (e.g. mentor deleted the recurrence/rule after a booking was made).
  const orphanVirtualItems: EditorSlotWithMeta[] = [];
  virtualByStart.forEach(({ slot: virtualSlot, blockType }, occUnix) => {
    if (coveredStarts.has(occUnix)) return;
    const slotStart = Math.floor(virtualSlot.start.getTime() / 1000);
    const slotEnd = Math.floor(virtualSlot.end.getTime() / 1000);
    const isPast = slotStart <= nowSec;
    const matchedReservation = findMatchedReservation(
      reservations,
      slotStart,
      slotEnd
    );
    orphanVirtualItems.push({
      slot: virtualSlot,
      isPast,
      reservationBlock: blockType,
      matchedReservation,
    });
  });

  const slotsWithMeta = [...allowItems, ...orphanVirtualItems].sort(
    (a, b) => a.slot.start.getTime() - b.slot.start.getTime()
  );

  const futureSlots = allowItems
    .filter((item) => !item.isPast)
    .map((item) => item.slot);

  return { slotsWithMeta, futureSlots };
}

/**
 * Pure domain computation for mentor booking availability.
 * Expands RRules in a single pass across `draftRows`, indexes occurrences by
 * `dateKey`, and locks all past-occurrence checks to the frozen `nowSec` instant.
 */
export function computeBookingAvailability({
  draftRows,
  nowSec,
  includeBookedDates = false,
  selectedDate = null,
  reservations = [],
}: ComputeBookingAvailabilityParams): BookingAvailabilityModel {
  // 1. Collect BOOKED and PENDING start timestamps
  const bookedStarts = new Set<number>();
  const pendingStarts = new Set<number>();
  for (const s of draftRows) {
    if (s.type === 'BOOKED') bookedStarts.add(s.dtstart);
    else if (s.type === 'PENDING') pendingStarts.add(s.dtstart);
  }

  // 2. Single-pass RRule expansion and per-date indexing
  const seenOccurrenceIds = new Set<string>();
  const parsedOccurrences: ParsedMentorTimeslot[] = [];
  const futureAllowByDate = new Map<string, ParsedMentorTimeslot[]>();

  const availableDatesSet = new Set<string>();
  const bookedDatesSet = new Set<string>();
  const allowedDatesSet = new Set<string>();
  const datesWithPending = new Set<string>();
  const datesWithBooked = new Set<string>();

  for (const row of draftRows) {
    const slotDurationSeconds = row.dtend - row.dtstart;
    const durationMinutes = Math.round(slotDurationSeconds / 60);
    const isRecurring = !!row.rrule;
    const rawOccurrences = row.rrule
      ? expandRrule(row.dtstart, row.rrule)
      : [row.dtstart];
    const exdateSet = row.exdate.length > 0 ? new Set(row.exdate) : null;

    for (const occ of rawOccurrences) {
      if (exdateSet?.has(occ)) continue;

      const start = new Date(occ * 1000);
      const end = new Date((occ + slotDurationSeconds) * 1000);
      const dateKey = dayjs(start).format('YYYY-MM-DD');
      const occurrenceId = `${row.id}_${occ}`;

      const parsed: ParsedMentorTimeslot = {
        occurrenceId,
        id: row.id,
        occurrenceUnix: occ,
        type: row.type,
        start,
        end,
        durationMinutes,
        formatted: `${dayjs(start).format('YYYY-MM-DD hh:mm A')} ~ ${dayjs(end).format('hh:mm A')}`,
        dateKey,
        rrule: row.rrule ?? undefined,
        exdate: row.exdate,
        slotDurationSeconds,
        isRecurringInstance: isRecurring,
      };

      if (!seenOccurrenceIds.has(occurrenceId)) {
        seenOccurrenceIds.add(occurrenceId);
        parsedOccurrences.push(parsed);
      }

      if (row.type === 'ALLOW' && occ > nowSec) {
        const list = futureAllowByDate.get(dateKey);
        if (list) {
          list.push(parsed);
        } else {
          futureAllowByDate.set(dateKey, [parsed]);
        }

        const isTaken = bookedStarts.has(occ) || pendingStarts.has(occ);
        if (isTaken) {
          bookedDatesSet.add(dateKey);
          // Match deduplicateBookingSlots precedence: BOOKED wins over PENDING on the same dtstart
          if (bookedStarts.has(occ)) {
            datesWithBooked.add(dateKey);
          } else if (pendingStarts.has(occ)) {
            datesWithPending.add(dateKey);
          }
        } else {
          availableDatesSet.add(dateKey);
        }

        if (includeBookedDates || !isTaken) {
          allowedDatesSet.add(dateKey);
        }
      }
    }

    // Also include dates from standalone future virtual BOOKED/PENDING rows in bookedDates
    if (
      (row.type === 'BOOKED' || row.type === 'PENDING') &&
      row.dtstart > nowSec
    ) {
      bookedDatesSet.add(dayjs(row.dtstart * 1000).format('YYYY-MM-DD'));
    }
  }

  parsedOccurrences.sort((a, b) => a.start.getTime() - b.start.getTime());

  const occurrencesByDate = new Map<string, ParsedMentorTimeslot[]>();
  for (const parsed of parsedOccurrences) {
    const list = occurrencesByDate.get(parsed.dateKey);
    if (list) {
      list.push(parsed);
    } else {
      occurrencesByDate.set(parsed.dateKey, [parsed]);
    }
  }

  // 3. Sorted date arrays and earliest selectable date
  const availableDates = Array.from(availableDatesSet).sort();
  const bookedDates = Array.from(bookedDatesSet).sort();
  const allowedDates = Array.from(allowedDatesSet).sort();
  const earliestSelectableDate =
    allowedDates.length > 0 ? allowedDates[0] : null;

  // 4. Compute bookingStatusByDate (date-level priority: PENDING > BOOKED)
  const bookingStatusByDate = new Map<string, BookingStatus>();
  datesWithBooked.forEach((dateKey) => {
    bookingStatusByDate.set(dateKey, 'BOOKED');
  });
  datesWithPending.forEach((dateKey) => {
    bookingStatusByDate.set(dateKey, 'PENDING');
  });

  // 5. O(occurrences-on-date) slot generator bound to frozen nowSec
  const generateBookingSlots = (
    dateKey: string,
    currentReservations: Reservation[] | undefined = reservations
  ): BookingSlot[] => {
    const allowOnDate = futureAllowByDate.get(dateKey);
    if (!allowOnDate || allowOnDate.length === 0) return [];

    const result: BookingSlot[] = allowOnDate.map((parsed) => {
      const occ = parsed.occurrenceUnix;
      const slotEnd = occ + parsed.slotDurationSeconds;
      const matchedRes = findMatchedReservation(
        currentReservations,
        occ,
        slotEnd
      );
      const isBooked = bookedStarts.has(occ);
      const status = isBooked
        ? ('BOOKED' as const)
        : pendingStarts.has(occ)
          ? ('PENDING' as const)
          : null;

      return {
        start: parsed.start,
        end: parsed.end,
        scheduleId: parsed.id,
        isBooked,
        status,
        menteeName: matchedRes?.name,
        reservation: matchedRes,
      };
    });

    return deduplicateBookingSlots(result);
  };

  // 6. O(occurrences-on-date) editor slot projection bound to frozen nowSec
  const getOccurrencesForDate = (dateKey: string): ParsedMentorTimeslot[] =>
    occurrencesByDate.get(dateKey) ?? [];

  const projectEditorSlots = (
    dateKey: string | null,
    currentReservations: Reservation[] | undefined = reservations
  ) => {
    const forDate = dateKey ? getOccurrencesForDate(dateKey) : [];
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
    parsedOccurrences,
    bookingStatusByDate,
    getOccurrencesForDate,
    generateBookingSlots,
    projectEditorSlots,
  };
}
