import type { components } from '@/types/api';
import type { Reservation } from '@/types/reservation';

/** 'YYYY-MM' — used to bucket per-month draft state in MonthDraftStore & useMentorSchedule. */
export type MonthKey = string;

export type DtType = 'ALLOW' | 'FORBIDDEN' | 'BOOKED' | 'PENDING';

type SegmentRecord = components['schemas']['TimeSlotDTO'];

// id: negative values are temporary local ids for new slots (-1, -2, ...)
// type: narrowed from SegmentVO.dt_type
// exdate: nulls excluded from SegmentVO.exdate
export type RawMentorTimeslot = Pick<
  SegmentRecord,
  'dtstart' | 'dtend' | 'rrule'
> & {
  id: number;
  type: DtType;
  exdate: number[];
};

export interface ScheduleMonthRef {
  userId: string;
  year: number;
  month: number; // 1-12
}

/**
 * Pure domain representation of an ALLOW timeslot to be upserted for a dirty
 * month. Contains zero transport DTO fields (`user_id`, `dt_type`, `dt_year`,
 * `dt_month`, `timezone`); serialization to `TimeSlotDTO` happens in one place
 * inside `saveMentorSchedule`.
 */
export interface ScheduleUpsertSlot {
  /** Present only when updating an already-persisted backend schedule row. */
  id?: number;
  dtstart: number;
  dtend: number;
  rrule?: string;
  exdate: number[];
}

export interface MonthSyncRequest {
  ref: ScheduleMonthRef;
  upsertPayload: ScheduleUpsertSlot[];
  deleteIds: number[];
}

export type SyncFailureReason = 'conflict' | 'unknown';

/** Internal — syncMonthSchedule passes raws back to the store/hook on success. */
export type SyncOutcome =
  | { ok: true; raws: RawMentorTimeslot[] }
  | { ok: false; reason: SyncFailureReason; message: string };

export interface MonthSyncResult {
  /** 'YYYY-MM' for the corresponding request's ref. */
  monthKey: MonthKey;
  outcome: SyncOutcome;
}

/** Public — surfaced to UI with per-month commit/failure context preserved. */
export type SyncResult =
  | {
      ok: true;
      committedMonthKeys: MonthKey[];
    }
  | {
      ok: false;
      reason: SyncFailureReason;
      message: string;
      failedMonthKey: MonthKey;
      committedMonthKeys: MonthKey[];
    };

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

export interface EditorSlotWithMeta {
  slot: ParsedMentorTimeslot;
  isPast: boolean;
  reservationBlock: 'BOOKED' | 'PENDING' | null;
  matchedReservation?: Reservation;
}

export type AddDraftSlotFailureReason =
  'OVERLAP' | 'NO_DATE_SELECTED' | 'INVALID_INPUT';

export type AddDraftSlotResult =
  | {
      success: true;
      added: number;
    }
  | {
      success: false;
      reason: AddDraftSlotFailureReason;
    };

export type UpdateDraftSlotFailureReason =
  'OVERLAP' | 'TARGET_MONTH_NOT_LOADED' | 'READ_ONLY';

export type UpdateDraftSlotResult =
  | {
      success: true;
      reason?: undefined;
    }
  | {
      success: false;
      reason?: UpdateDraftSlotFailureReason;
    };

/**
 * The mentor's own draft-mutation surface. Deliberately narrow: everything a
 * mutation needs to *address* an occurrence (selected date, month-loaded
 * gating, calendar navigation, reload/error) already lives on
 * `BookingCalendarReader` - the mentor viewing their own schedule always
 * receives both, and a caller wires the two together rather than reading the
 * same value under two names. See CONTEXT.md's `BookingAvailabilityModel`
 * section for the full reader/editor split.
 */
export type MentorScheduleEditor = {
  draftForSelectedDate: ParsedMentorTimeslot[];
  /** All parsed draft occurrences across loaded months (for editor/test inspection). */
  draftOccurrences?: ParsedMentorTimeslot[];
  /** Pre-projected editor slots for the selected date (including virtual slots and matched reservations). */
  slotsWithMeta: EditorSlotWithMeta[];
  /** Future-only ALLOW occurrences on the selected date for AddSlotModal defaults. */
  futureSlots: ParsedMentorTimeslot[];
  /**
   * Add one ALLOW entry at `startTime` for `durationMinutes`. If
   * `weeklyWithinMonth` is true, the entry is a single row with a weekly
   * `FREQ=WEEKLY;COUNT=N` rrule covering every same-weekday date remaining in
   * the selected date's month; otherwise it's a non-recurring row. Atomic:
   * if any occurrence overlaps an existing ALLOW slot, the entire batch is
   * rejected with `{ success: false, reason: 'OVERLAP' }`.
   */
  addSlotForSelectedDate: (opts: {
    startTime: string; // HH:mm
    durationMinutes: SlotDurationMinutes;
    weeklyWithinMonth?: boolean;
  }) => AddDraftSlotResult;
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
  reservations: Reservation[];
};

export interface BookingCalendarReader {
  year?: number;
  month?: number;
  selectedDate: string | null;
  setSelectedDate: (dateKey: string | null) => void;
  selectedSlot?: BookingSlot | null;
  setSelectedSlot?: (slot: BookingSlot | null) => void;
  onMonthChange?: (
    date: Date,
    options?: { preserveSelectedDate?: boolean }
  ) => void;
  clampSelectedDateToToday?: () => void;
  /** All local dates (YYYY-MM-DD) that have at least one ALLOW occurrence after expanding rrules. */
  allowedDates: string[];
  /** Dates with open (unbooked, non-pending) future ALLOW occurrences. */
  availableDates?: string[];
  /** Dates with future BOOKED or PENDING occurrences. */
  bookedDates?: string[];
  /** Earliest selectable date (YYYY-MM-DD) among allowedDates, or null when none exist. */
  earliestSelectableDate?: string | null;
  /**
   * The selected date's booking slots, bundled with the two loading flags
   * that gate whether it's safe to render/interact with them
   * (`slotsSnapshot.monthLoaded` for the schedule fetch,
   * `slotsSnapshot.reservationsLoaded` for each slot's `.reservation`). This
   * is the single read location for both flags - there is no top-level
   * mirror, so a caller never has to guess which one to read.
   */
  slotsSnapshot: SlotsSnapshot;
  /** True once the current month's fetched rows have been mirrored into MonthDraftStore. */
  isMonthSynced?: boolean;
  getDayBookingStatus: (dateKey: string) => BookingStatus | null;
  isFetching: boolean;
  reload?: () => Promise<void>;
  hasError?: boolean;
}
