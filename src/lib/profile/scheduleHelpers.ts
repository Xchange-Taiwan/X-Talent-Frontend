import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { RRule } from 'rrule';

import { SegmentVO } from '@/services/mentor-schedule/schedule';

dayjs.extend(isSameOrBefore);

export type DtType = 'ALLOW' | 'BOOKED' | 'PENDING';

/** 'YYYY-MM' — used to bucket per-month draft state in useMentorSchedule. */
export type MonthKey = string;

export const DEFAULT_MEETING_DURATION_MINUTES = 30;

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
// meetingDurationMinutes: new-format marker. null = legacy MINUTELY-rrule row
//   where (dtstart, dtend) is one sub-slot and `rrule` iterates sub-slots.
//   When set: (dtstart, dtend) is the whole block and sub-slots are derived
//   by dividing the block by this length — `rrule` is reserved for true
//   weekly/daily recurrence (not yet exposed in the UI).
export type RawMentorTimeslot = Pick<
  SegmentVO,
  'dtstart' | 'dtend' | 'rrule'
> & {
  id: number;
  type: DtType;
  exdate: number[];
  meetingDurationMinutes: number | null;
};

export type ParsedMentorTimeslot = {
  id: number;
  type: DtType;
  start: Date; // block start (= dtstart for all types)
  end: Date; // block end: derived via getBlockEnd to handle both formats
  durationMinutes: number;
  formatted: string;
  dateKey: string; // YYYY-MM-DD (local)
  rrule?: string;
  exdate: number[];
  slotDurationSeconds: number; // duration of one sub-slot
  meetingDurationMinutes: number | null;
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
 * Subdivide a block [start, end) into sub-slot start timestamps. Trailing
 * remainder shorter than one slot is dropped.
 */
export function subdivideBlock(
  blockStart: number,
  blockEnd: number,
  slotMinutes: number
): number[] {
  if (slotMinutes <= 0 || blockEnd <= blockStart) return [];
  const slotSec = slotMinutes * 60;
  const out: number[] = [];
  for (let t = blockStart; t + slotSec <= blockEnd; t += slotSec) {
    out.push(t);
  }
  return out;
}

type SubSlotInput = Pick<
  RawMentorTimeslot,
  'dtstart' | 'dtend' | 'rrule' | 'meetingDurationMinutes'
>;

/**
 * Return all sub-slot start timestamps for a slot, hiding the new vs. legacy
 * format split. New format divides (dtstart, dtend) by meetingDurationMinutes;
 * legacy expands the FREQ=MINUTELY rrule.
 */
export function getSubSlotStarts(slot: SubSlotInput): number[] {
  if (slot.meetingDurationMinutes != null && slot.meetingDurationMinutes > 0) {
    return subdivideBlock(
      slot.dtstart,
      slot.dtend,
      slot.meetingDurationMinutes
    );
  }
  return expandRrule(slot.dtstart, slot.rrule);
}

/** Block end timestamp for a slot. New format: dtend. Legacy: last sub-slot end. */
export function getBlockEnd(slot: SubSlotInput): number {
  if (slot.meetingDurationMinutes != null && slot.meetingDurationMinutes > 0) {
    return slot.dtend;
  }
  const occs = expandRrule(slot.dtstart, slot.rrule);
  const last = occs[occs.length - 1] ?? slot.dtstart;
  return last + (slot.dtend - slot.dtstart);
}

/** Sub-slot length in seconds. New format reads meetingDurationMinutes; legacy uses dtend-dtstart. */
export function getSubSlotDurationSeconds(slot: SubSlotInput): number {
  if (slot.meetingDurationMinutes != null && slot.meetingDurationMinutes > 0) {
    return slot.meetingDurationMinutes * 60;
  }
  return slot.dtend - slot.dtstart;
}

/**
 * Sub-slot starts derived from a ParsedMentorTimeslot. Convenience wrapper
 * for UI code that holds parsed slots (the dialog) so it doesn't need to
 * re-derive raw fields. p.end is treated as the block end in both formats —
 * see formatTimeslot for how that's computed.
 */
export function parsedSubSlotStarts(p: ParsedMentorTimeslot): number[] {
  const startSec = Math.floor(p.start.getTime() / 1000);
  if (p.meetingDurationMinutes != null && p.meetingDurationMinutes > 0) {
    const endSec = Math.floor(p.end.getTime() / 1000);
    return subdivideBlock(startSec, endSec, p.meetingDurationMinutes);
  }
  return expandRrule(startSec, p.rrule);
}

export function segmentToRaw(t: SegmentVO): RawMentorTimeslot {
  return {
    id: t.id ?? Math.floor(Math.random() * 1e9),
    type: t.dt_type as RawMentorTimeslot['type'],
    dtstart: t.dtstart,
    dtend: t.dtend,
    rrule: t.rrule ?? undefined,
    exdate: (t.exdate ?? []).filter((x): x is number => x !== null),
    meetingDurationMinutes: t.meeting_duration_minutes ?? null,
  };
}

export function formatTimeslot(r: RawMentorTimeslot): ParsedMentorTimeslot {
  const start = new Date(r.dtstart * 1000);
  const slotDurationSeconds = getSubSlotDurationSeconds(r);
  const end = new Date(getBlockEnd(r) * 1000);

  const durationMinutes = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60)
  );
  const dateKey = dayjs(start).format('YYYY-MM-DD');
  return {
    id: r.id,
    type: r.type,
    start,
    end,
    durationMinutes,
    formatted: `${dayjs(start).format('YYYY-MM-DD hh:mm A')} ~ ${dayjs(end).format('hh:mm A')}`,
    dateKey,
    rrule: r.rrule ?? undefined,
    exdate: r.exdate,
    slotDurationSeconds,
    meetingDurationMinutes: r.meetingDurationMinutes,
  };
}

export function nextTempId(rows: RawMentorTimeslot[]): number {
  const negatives = rows.filter((r) => r.id < 0).map((r) => r.id);
  return negatives.length ? Math.min(...negatives) - 1 : -1;
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
 * Whether [dtstart, dtstart+blockDurationSeconds) overlaps any other ALLOW
 * block on the same local date in `rows`. Pass `ignoreId` to skip the slot
 * being edited; pass `null` when adding a brand-new slot.
 */
export function hasOverlapAt(
  rows: RawMentorTimeslot[],
  ignoreId: number | null,
  dateKey: string,
  dtstart: number,
  blockDurationSeconds: number
): boolean {
  const blockEnd = dtstart + blockDurationSeconds;
  return rows.some((r) => {
    if (r.id === ignoreId) return false;
    if (r.type !== 'ALLOW') return false;
    const rDate = dayjs(r.dtstart * 1000).format('YYYY-MM-DD');
    if (rDate !== dateKey) return false;
    const rEnd = getBlockEnd(r);
    return dtstart < rEnd && blockEnd > r.dtstart;
  });
}
