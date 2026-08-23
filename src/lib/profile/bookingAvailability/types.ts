import { SyncResult } from '@/services/mentor-schedule/sync';
import type { Reservation } from '@/types/reservation';

export type DtType = 'ALLOW' | 'FORBIDDEN' | 'BOOKED' | 'PENDING';

/**
 * Represents a SINGLE occurrence of an ALLOW/BOOKED/PENDING entry. A non-rrule
 * row produces exactly one entry; a weekly-rrule row produces one entry per
 * non-exdated occurrence. The pair (id, occurrenceUnix) uniquely identifies
 * each card the user sees in the editor and is what mutator callbacks use to
 * scope edits/deletes back to the right occurrence of the underlying row.
 */
export type ParsedMentorTimeslot = {
  occurrenceId: string; // unique composite key for the occurrence, e.g. `${id}_${occurrenceUnix}`
  id: number; // = parent row id; shared by all occurrences of an rrule row
  occurrenceUnix: number; // dtstart of THIS occurrence (= row.dtstart for non-recurring)
  type: DtType;
  start: Date; // = new Date(occurrenceUnix * 1000)
  end: Date; // = start + slotDurationSeconds
  durationMinutes: number;
  formatted: string;
  dateKey: string; // YYYY-MM-DD (local) of this occurrence
  rrule?: string; // copied from parent row
  exdate: number[]; // copied from parent row
  slotDurationSeconds: number;
  isRecurringInstance: boolean; // true if parent row has rrule
};

export type BookingStatus = 'PENDING' | 'BOOKED';

export type BookingSlot = {
  start: Date;
  end: Date;
  scheduleId: number; // parent ALLOW slot id
  isBooked: boolean;
  status: BookingStatus | null;
  menteeName?: string;
  /** The reservation matched to this occurrence, if any — lets consumers
   * (e.g. a PENDING-slot click handler) act on it directly instead of
   * re-running findMatchedReservation themselves. */
  reservation?: Reservation;
};

export type SlotDurationMinutes = 30 | 45 | 60;

/**
 * The selected date's booking slots, bundled with the two loading flags
 * that gate whether it's safe to render/interact with them (`monthLoaded`
 * for `slots` itself, `reservationsLoaded` for each slot's `.reservation`).
 * These three always travel together from useMentorSchedule down through
 * BookingForm to MentorScheduleConfig, so they're grouped into one prop
 * instead of three separately-threaded ones.
 */
export interface SlotsSnapshot {
  slots: BookingSlot[];
  monthLoaded: boolean;
  reservationsLoaded: boolean;
}

export type UpdateDraftSlotResult = {
  success: boolean;
  reason?: 'OVERLAP' | 'TARGET_MONTH_NOT_LOADED' | 'READ_ONLY';
};

export type MentorScheduleEditor = {
  selectedDate: string | null;
  setSelectedDate: (dateStr: string | null) => void;
  draftForSelectedDate: ParsedMentorTimeslot[];
  /**
   * Add one ALLOW entry at `startTime` for `durationMinutes`. If
   * `weeklyWithinMonth` is true, the entry is a single row with a weekly
   * `FREQ=WEEKLY;COUNT=N` rrule covering every same-weekday date remaining in
   * the selected date's month; otherwise it's a non-recurring row. Returns
   * counts of created occurrences so callers can show "added N, skipped M".
   */
  addSlotForSelectedDate: (opts: {
    startTime: string; // HH:mm
    durationMinutes: SlotDurationMinutes;
    weeklyWithinMonth?: boolean;
  }) => { added: number; skipped: number };
  /**
   * Edit a single occurrence. For non-recurring rows this updates the row
   * directly. For recurring rows the targeted occurrence is detached: it is
   * added to the parent's exdate and a new non-recurring row is created with
   * the patch applied — leaving sibling occurrences untouched.
   */
  updateDraftSlot: (
    id: number,
    occurrenceUnix: number,
    patch: {
      startTime?: string; // HH:mm
      durationMinutes?: SlotDurationMinutes;
    }
  ) => UpdateDraftSlotResult;
  /**
   * Delete a single occurrence. Non-recurring rows are removed entirely; on
   * recurring rows the occurrence is added to exdate, and the row is removed
   * only when no active occurrences remain.
   */
  deleteDraftSlot: (id: number, occurrenceUnix: number) => void;
  confirmChanges: () => Promise<SyncResult>;
  resetChanges: () => void;
  /** All local dates (YYYY-MM-DD) that have at least one ALLOW occurrence after expanding rrules. */
  allowedDates: string[];
  /** Per-month: false while the *current* (year, month) is being fetched after a cache miss. */
  monthLoaded: boolean;
  reservations: Reservation[];
};

export interface BookingCalendarReader {
  selectedDate: string | null;
  setSelectedDate: (dateKey: string | null) => void;
  allowedDates: string[];
  slotsSnapshot: SlotsSnapshot;
  getDayBookingStatus: (dateKey: string) => BookingStatus | null;
  monthLoaded: boolean;
  /**
   * False while the reservations fetch (which populates each booked slot's
   * `.reservation`) is in flight — separate from monthLoaded's schedule
   * fetch. Gate any "click a booked slot" UI on this too: a slot can already
   * report status PENDING/BOOKED from the schedule fetch while its
   * `.reservation` is still unset here. Mirrors monthLoaded: exposed at the
   * top level (in addition to slotsSnapshot.reservationsLoaded) so a
   * read-only consumer that needs it directly doesn't have to reach into
   * slotsSnapshot for one flag but not the other.
   */
  reservationsLoaded: boolean;
  isFetching: boolean;
  reload?: () => Promise<void>;
}
