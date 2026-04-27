import dayjs from 'dayjs';

import { RawMentorTimeslot, segmentToRaw } from '@/lib/profile/scheduleHelpers';

import {
  deleteMentorSchedule,
  fetchMentorSchedule,
  saveMentorSchedule,
  TimeSlotDTO,
} from './schedule';

export interface ScheduleMonthRef {
  userId: string;
  year: number;
  month: number; // 1-12
}

/** Fetch + filter to slots whose dtstart falls in the requested local month. */
export async function loadMonthSchedule(
  ref: ScheduleMonthRef
): Promise<RawMentorTimeslot[]> {
  const data = await fetchMentorSchedule(ref);
  return (data?.segments ?? []).map(segmentToRaw).filter((r) => {
    const d = dayjs(r.dtstart * 1000);
    return d.year() === ref.year && d.month() + 1 === ref.month;
  });
}

/**
 * PUT all upsert slots, DELETE all removed ids, then reload the month.
 * Returns the freshly loaded slots, or null if any sync request failed.
 */
export async function syncMonthSchedule(params: {
  ref: ScheduleMonthRef;
  upsertPayload: TimeSlotDTO[];
  deleteIds: number[];
}): Promise<RawMentorTimeslot[] | null> {
  const { ref, upsertPayload, deleteIds } = params;

  const endOfMonthUnix = dayjs(
    `${ref.year}-${String(ref.month).padStart(2, '0')}-01`
  )
    .endOf('month')
    .hour(23)
    .minute(59)
    .second(59)
    .millisecond(0)
    .unix();

  try {
    if (upsertPayload.length > 0) {
      const ok = await saveMentorSchedule({
        userId: ref.userId,
        until: endOfMonthUnix,
        timeslots: upsertPayload,
      });
      if (!ok) throw new Error('PUT failed');
    }

    if (deleteIds.length > 0) {
      await Promise.all(
        deleteIds.map(async (id) => {
          const ok = await deleteMentorSchedule({
            userId: ref.userId,
            scheduleId: id,
          });
          if (!ok) throw new Error(`DELETE failed: ${id}`);
        })
      );
    }

    return await loadMonthSchedule(ref);
  } catch (e) {
    console.error('[MentorSchedule] sync failed:', e);
    return null;
  }
}
