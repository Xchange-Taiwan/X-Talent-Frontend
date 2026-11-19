import dayjs from 'dayjs';

import { ApiError } from '@/lib/apiClient';
import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
import type {
  MonthSyncRequest,
  MonthSyncResult,
  ScheduleMonthRef,
  ScheduleUpsertSlot,
  SyncFailureReason,
  SyncOutcome,
  SyncResult,
} from '@/lib/profile/bookingAvailability/types';
import {
  endOfMonthUnix,
  monthKeyFromYearMonth,
  RawMentorTimeslot,
  segmentToRaw,
} from '@/lib/profile/scheduleHelpers';

import {
  deleteMentorSchedule,
  fetchMentorSchedule,
  saveMentorSchedule,
} from './schedule';

export type {
  MonthSyncRequest,
  MonthSyncResult,
  ScheduleMonthRef,
  ScheduleUpsertSlot,
  SyncFailureReason,
  SyncOutcome,
  SyncResult,
};

/**
 * Fetch + filter to slots whose dtstart falls in the requested local month.
 * This is the raw network read: caching, de-duplication and cancellation are
 * `MentorScheduleReadModel`'s job, not this function's.
 */
export async function loadMonthSchedule(
  ref: ScheduleMonthRef,
  signal?: AbortSignal
): Promise<RawMentorTimeslot[]> {
  const data = await fetchMentorSchedule(ref, signal);
  return (data?.segments ?? []).map(segmentToRaw).filter((r) => {
    const d = dayjs(r.dtstart * 1000);
    return d.year() === ref.year && d.month() + 1 === ref.month;
  });
}

/**
 * Force a network fetch and publish the result through the read model,
 * bypassing any cache hit. The write cancels whatever fetch was in flight
 * for that month, so a slower response can never clobber these rows.
 */
export async function loadMonthScheduleFresh(
  ref: ScheduleMonthRef
): Promise<RawMentorTimeslot[]> {
  const raws = await loadMonthSchedule(ref);
  scheduleReadModel.set(ref, raws);
  return raws;
}

/**
 * Fire-and-forget background fetch that populates the read model for a
 * month. No-op when the month is already cached or a request is in flight.
 * Failures are silenced — prefetch must never disrupt the user.
 */
export function prefetchMonthSchedule(ref: ScheduleMonthRef): void {
  scheduleReadModel.prefetch(ref, (signal) => loadMonthSchedule(ref, signal));
}

/**
 * PUT all upsert slots, DELETE all removed ids, then reload the month.
 *
 * Returns SyncResult — on failure the caller can surface `message` (raw
 * backend `msg`, e.g. "There is 1 conflict in 2026/5") and `reason` to map
 * to user-friendly UI copy. PUT failure aborts before DELETE so we don't
 * partially mutate the schedule.
 */
export async function syncMonthSchedule(
  params: MonthSyncRequest
): Promise<SyncOutcome> {
  const { ref, upsertPayload, deleteIds } = params;
  const until = endOfMonthUnix(ref.year, ref.month);

  try {
    if (upsertPayload.length > 0) {
      await saveMentorSchedule({
        userId: ref.userId,
        until,
        timeslots: upsertPayload,
      });
    }

    if (deleteIds.length > 0) {
      await Promise.all(
        deleteIds.map((id) =>
          deleteMentorSchedule({
            userId: ref.userId,
            scheduleId: id,
          })
        )
      );
    }

    const raws = await loadMonthScheduleFresh(ref);
    return { ok: true, raws };
  } catch (e) {
    const message =
      e instanceof ApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Sync failed';
    const reason: SyncFailureReason = /conflict/i.test(message)
      ? 'conflict'
      : 'unknown';
    return { ok: false, reason, message };
  }
}

/**
 * Sequentially commit one or more months. Each month is independent —
 * earlier success is NOT rolled back if a later month fails. Callers use the
 * per-month outcomes to update saved/draft state and to surface a targeted
 * error toast (e.g. "5 月時段衝突"). Sequential (not parallel) avoids cache
 * write races and matches the single-month sync's PUT→DELETE ordering.
 */
export async function syncMonths(
  requests: MonthSyncRequest[]
): Promise<MonthSyncResult[]> {
  const results: MonthSyncResult[] = [];
  for (const req of requests) {
    const monthKey = monthKeyFromYearMonth(req.ref.year, req.ref.month);
    const outcome = await syncMonthSchedule(req);
    results.push({ monthKey, outcome });
  }
  return results;
}
