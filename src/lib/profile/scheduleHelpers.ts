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
// dtstart/dtend: block bounds (entire window). Sub-slots are derived via
//   expandBlockSubSlots(dtstart, dtend, meetingDurationMinutes).
export type RawMentorTimeslot = Pick<
  SegmentVO,
  'dtstart' | 'dtend' | 'rrule'
> & {
  id: number;
  type: DtType;
  exdate: number[];
  meetingDurationMinutes: number;
};

export type ParsedMentorTimeslot = {
  id: number;
  type: DtType;
  start: Date; // block start
  end: Date; // block end
  durationMinutes: number;
  formatted: string;
  dateKey: string; // YYYY-MM-DD (local)
  rrule?: string;
  exdate: number[];
  slotDurationSeconds: number; // duration of one sub-slot (meetingDurationMinutes * 60)
  meetingDurationMinutes: number;
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

/** Sub-slot start times within a block, derived from meetingDurationMinutes. */
export function expandBlockSubSlots(
  dtstart: number,
  dtend: number,
  meetingDurationMinutes: number
): number[] {
  if (meetingDurationMinutes <= 0 || dtend <= dtstart) return [dtstart];
  const step = meetingDurationMinutes * 60;
  const result: number[] = [];
  for (let t = dtstart; t < dtend; t += step) result.push(t);
  return result;
}

export function segmentToRaw(t: SegmentVO): RawMentorTimeslot {
  const id = t.id ?? Math.floor(Math.random() * 1e9);
  const type = t.dt_type as RawMentorTimeslot['type'];
  const exdate = (t.exdate ?? []).filter((x): x is number => x !== null);

  if (t.meeting_duration_minutes != null) {
    return {
      id,
      type,
      dtstart: t.dtstart,
      dtend: t.dtend,
      rrule: t.rrule ?? undefined,
      exdate,
      meetingDurationMinutes: t.meeting_duration_minutes,
    };
  }

  // Legacy fallback: backend pre-Phase-1-4 row with no meeting_duration_minutes.
  // Old MINUTELY rrule encoded sub-slots; block end was lastOcc + (dtend-dtstart).
  const subSlotSeconds = Math.max(0, t.dtend - t.dtstart);
  const isMinutely = t.rrule?.includes('FREQ=MINUTELY');
  let blockEnd = t.dtend;
  if (isMinutely) {
    const occs = expandRrule(t.dtstart, t.rrule);
    const lastOcc = occs[occs.length - 1] ?? t.dtstart;
    blockEnd = lastOcc + subSlotSeconds;
  }
  return {
    id,
    type,
    dtstart: t.dtstart,
    dtend: blockEnd,
    rrule: isMinutely ? undefined : (t.rrule ?? undefined),
    exdate,
    meetingDurationMinutes:
      subSlotSeconds > 0 ? Math.round(subSlotSeconds / 60) : 0,
  };
}

export function formatTimeslot(r: RawMentorTimeslot): ParsedMentorTimeslot {
  const start = new Date(r.dtstart * 1000);
  const end = new Date(r.dtend * 1000);
  const slotDurationSeconds = r.meetingDurationMinutes * 60;
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
    return dtstart < r.dtend && blockEnd > r.dtstart;
  });
}
