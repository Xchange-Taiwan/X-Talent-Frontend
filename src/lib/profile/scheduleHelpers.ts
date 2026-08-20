import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { RRule } from 'rrule';

import { SegmentVO } from '@/services/mentor-schedule/schedule';

dayjs.extend(isSameOrBefore);

export type DtType = 'ALLOW' | 'FORBIDDEN' | 'BOOKED' | 'PENDING';

/** 'YYYY-MM' — used to bucket per-month draft state in useMentorSchedule. */
export type MonthKey = string;

export function monthKeyFromUnix(unix: number): MonthKey {
  return dayjs(unix * 1000).format('YYYY-MM');
}

export function monthKeyFromDateStr(dateStr: string): MonthKey {
  return dateStr.slice(0, 7);
}

export function monthKeyFromYearMonth(year: number, month: number): MonthKey {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const [y, m] = key.split('-');
  return { year: Number(y), month: Number(m) };
}

// id: negative values are temporary local ids for new slots (-1, -2, ...)
// type: narrowed from SegmentVO.dt_type
// exdate: nulls excluded from SegmentVO.exdate
export type RawMentorTimeslot = Pick<
  SegmentVO,
  'dtstart' | 'dtend' | 'rrule'
> & {
  id: number;
  type: DtType;
  exdate: number[];
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

export type BookingSlot = {
  start: Date;
  end: Date;
  scheduleId: number; // parent ALLOW slot id
  isBooked: boolean;
};

/** Expand an rrule string from dtstart, returning all occurrence dtstart values (unix seconds). */
export function expandRrule(
  dtstart: number,
  rruleStr: string | undefined | null
): number[] {
  if (!rruleStr) return [dtstart];
  try {
    const options = RRule.parseString(rruleStr);
    options.dtstart = new Date(dtstart * 1000);
    const rule = new RRule(options);
    return rule.all().map((d) => Math.floor(d.getTime() / 1000));
  } catch {
    return [dtstart];
  }
}

/**
 * Active occurrences of a row = rrule expansion minus exdate. For non-recurring
 * rows this returns `[dtstart]` (or `[]` if dtstart is exdated, which shouldn't
 * happen in practice).
 */
export function activeOccurrences(r: RawMentorTimeslot): number[] {
  return expandRrule(r.dtstart, r.rrule).filter((o) => !r.exdate.includes(o));
}

export function segmentToRaw(t: SegmentVO): RawMentorTimeslot {
  return {
    id: t.id ?? Math.floor(Math.random() * 1e9),
    type: t.dt_type as RawMentorTimeslot['type'],
    dtstart: t.dtstart,
    dtend: t.dtend,
    rrule: t.rrule ?? undefined,
    exdate: (t.exdate ?? []).filter((x): x is number => x !== null),
  };
}

/**
 * Expand a row into one ParsedMentorTimeslot per active occurrence. A
 * non-recurring row yields a length-1 array; a weekly-rrule row yields one
 * entry per non-exdated occurrence so the UI can render and act on each
 * occurrence independently.
 */
export function formatTimeslot(r: RawMentorTimeslot): ParsedMentorTimeslot[] {
  const slotDurationSeconds = r.dtend - r.dtstart;
  const durationMinutes = Math.round(slotDurationSeconds / 60);
  const isRecurring = !!r.rrule;
  return activeOccurrences(r).map((occ) => {
    const start = new Date(occ * 1000);
    const end = new Date((occ + slotDurationSeconds) * 1000);
    const dateKey = dayjs(start).format('YYYY-MM-DD');
    return {
      occurrenceId: `${r.id}_${occ}`,
      id: r.id,
      occurrenceUnix: occ,
      type: r.type,
      start,
      end,
      durationMinutes,
      formatted: `${dayjs(start).format('YYYY-MM-DD hh:mm A')} ~ ${dayjs(end).format('hh:mm A')}`,
      dateKey,
      rrule: r.rrule ?? undefined,
      exdate: r.exdate,
      slotDurationSeconds,
      isRecurringInstance: isRecurring,
    };
  });
}

export function nextTempId(rows: RawMentorTimeslot[]): number {
  const negatives = rows.filter((r) => r.id < 0).map((r) => r.id);
  return negatives.length ? Math.min(...negatives) - 1 : -1;
}

/**
 * A backend-synthesized read-only placeholder representing a booked/pending
 * reservation block — not a real mentor_availability row. Distinguished from
 * a locally-created, not-yet-saved ALLOW draft (which also has a negative id
 * via nextTempId) by its `type`: only BOOKED/PENDING rows are ever virtual.
 */
export function isReadOnlyVirtualSlot(type: DtType, id: number): boolean {
  return id < 0 && (type === 'BOOKED' || type === 'PENDING');
}

/** Build a dayjs from a YYYY-MM-DD date and HH:mm time. */
export function buildDateTime(dateStr: string, timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  return dayjs(dateStr)
    .hour(h ?? 0)
    .minute(m ?? 0)
    .second(0)
    .millisecond(0);
}

/**
 * Find an existing recurring ALLOW row whose `occurrenceUnix` was previously
 * exdated (i.e. the user deleted just that one week) and whose duration
 * matches. Re-adding such an occurrence should undo the exdate on the
 * existing row rather than create a second, independent row at the same
 * time — submitting both together in one save otherwise reads as two
 * overlapping rows to the backend's conflict validation.
 */
export function findRestorableExdatedRow(
  rows: RawMentorTimeslot[],
  occurrenceUnix: number,
  durationSeconds: number
): RawMentorTimeslot | null {
  return (
    rows.find(
      (r) =>
        r.type === 'ALLOW' &&
        !!r.rrule &&
        r.exdate.includes(occurrenceUnix) &&
        r.dtend - r.dtstart === durationSeconds &&
        expandRrule(r.dtstart, r.rrule).includes(occurrenceUnix)
    ) ?? null
  );
}

/**
 * Whether any of the candidate occurrences (each `[unix, unix+durationSeconds)`)
 * overlap any active occurrence of an existing ALLOW row in `rows`. Pass
 * `ignoreRowId` to skip a row being edited (its current occurrences are
 * excluded entirely); pass `null` when adding a brand-new slot.
 */
export function hasAnyOccurrenceOverlap(
  rows: RawMentorTimeslot[],
  ignoreRowId: number | null,
  candidateOccurrences: number[],
  durationSeconds: number
): boolean {
  if (candidateOccurrences.length === 0) return false;
  return rows.some((r) => {
    if (r.id === ignoreRowId) return false;
    if (r.type !== 'ALLOW') return false;
    const existingDur = r.dtend - r.dtstart;
    const existingOccs = activeOccurrences(r);
    return existingOccs.some((eo) => {
      const eEnd = eo + existingDur;
      return candidateOccurrences.some((no) => {
        const nEnd = no + durationSeconds;
        return no < eEnd && nEnd > eo;
      });
    });
  });
}

const appendExdate = (exdates: number[], unix: number): number[] =>
  exdates.includes(unix) ? exdates : [...exdates, unix];

export function checkCrossMonthOverlap({
  id,
  occurrenceUnix,
  newDtstart,
  durationSeconds,
  isRecurring,
  currentDraftsMap,
  targetDraft,
}: {
  id: number;
  occurrenceUnix: number;
  newDtstart: number;
  durationSeconds: number;
  isRecurring: boolean;
  currentDraftsMap: Map<MonthKey, RawMentorTimeslot[]>;
  targetDraft: RawMentorTimeslot[];
}): boolean {
  const draftsToCheck = Array.from(currentDraftsMap.values()).flat();
  const isTargetLoaded = currentDraftsMap.has(monthKeyFromUnix(newDtstart));
  if (!isTargetLoaded) {
    draftsToCheck.push(...targetDraft);
  }

  let intermediateDraftsToCheck = draftsToCheck;
  if (isRecurring) {
    // If recurring, we simulate exdating the parent row
    intermediateDraftsToCheck = draftsToCheck.map((r: RawMentorTimeslot) =>
      r.id === id
        ? {
            ...r,
            exdate: appendExdate(r.exdate, occurrenceUnix),
          }
        : r
    );
  }

  // Run unified overlap check
  return hasAnyOccurrenceOverlap(
    intermediateDraftsToCheck,
    isRecurring ? null : id, // ignore current row ID only if it is non-recurring
    [newDtstart],
    durationSeconds
  );
}

/**
 * Deduplicates raw timeslots by id (for id > 0) to fix duplicate representations at their source,
 * merging the exdate arrays of any duplicates.
 */
export function deduplicateRawSlots(
  slots: RawMentorTimeslot[]
): RawMentorTimeslot[] {
  const map = new Map<number, RawMentorTimeslot>();
  const out: RawMentorTimeslot[] = [];
  for (const slot of slots) {
    if (slot.id <= 0) {
      out.push(slot);
      continue;
    }
    const existing = map.get(slot.id);
    if (existing) {
      existing.exdate.push(...slot.exdate);
    } else {
      const copy = { ...slot, exdate: [...slot.exdate] };
      map.set(slot.id, copy);
      out.push(copy);
    }
  }

  map.forEach((slot) => {
    slot.exdate = Array.from(new Set(slot.exdate));
  });

  return out;
}

/**
 * Deduplicates slots with the same start time, merging isBooked status.
 */
export function deduplicateBookingSlots(slots: BookingSlot[]): BookingSlot[] {
  const uniqueMap = new Map<number, BookingSlot>();
  for (const item of slots) {
    const key = item.start.getTime();
    const existing = uniqueMap.get(key);
    if (existing) {
      existing.isBooked = existing.isBooked || item.isBooked;
    } else {
      uniqueMap.set(key, { ...item });
    }
  }

  const uniqueResult = Array.from(uniqueMap.values());
  uniqueResult.sort((a, b) => a.start.getTime() - b.start.getTime());
  return uniqueResult;
}
