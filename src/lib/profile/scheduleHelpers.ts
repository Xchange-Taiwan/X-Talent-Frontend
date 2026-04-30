import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { RRule } from 'rrule';

import { SegmentVO } from '@/services/mentor-schedule/schedule';

dayjs.extend(isSameOrBefore);

export type DtType = 'ALLOW' | 'BOOKED' | 'PENDING';

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

export type ParsedMentorTimeslot = {
  id: number;
  type: DtType;
  start: Date; // block start (= dtstart for all types)
  end: Date; // block end: last occurrence end for ALLOW (derived from rrule), dtend for others
  durationMinutes: number;
  formatted: string;
  dateKey: string; // YYYY-MM-DD (local)
  rrule?: string;
  exdate: number[];
  slotDurationSeconds: number; // duration of one sub-slot (dtend - dtstart)
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

export function formatTimeslot(r: RawMentorTimeslot): ParsedMentorTimeslot {
  const start = new Date(r.dtstart * 1000);
  const slotDurationSeconds = r.dtend - r.dtstart;

  let end: Date;
  if (r.type === 'ALLOW' && r.rrule) {
    const occurrences = expandRrule(r.dtstart, r.rrule);
    const lastOccDtstart = occurrences[occurrences.length - 1] ?? r.dtstart;
    end = new Date((lastOccDtstart + slotDurationSeconds) * 1000);
  } else {
    end = new Date(r.dtend * 1000);
  }

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
  };
}

export function nextTempId(rows: RawMentorTimeslot[]): number {
  const negatives = rows.filter((r) => r.id < 0).map((r) => r.id);
  return negatives.length ? Math.min(...negatives) - 1 : -1;
}

export function buildRrule(
  blockDurationSeconds: number,
  slotDurationSeconds: number
): string {
  const count = Math.round(blockDurationSeconds / slotDurationSeconds);
  const intervalMinutes = Math.round(slotDurationSeconds / 60);
  return `FREQ=MINUTELY;INTERVAL=${intervalMinutes};COUNT=${count}`;
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
    const occs = expandRrule(r.dtstart, r.rrule);
    const rEnd = (occs[occs.length - 1] ?? r.dtstart) + (r.dtend - r.dtstart);
    return dtstart < rEnd && blockEnd > r.dtstart;
  });
}
