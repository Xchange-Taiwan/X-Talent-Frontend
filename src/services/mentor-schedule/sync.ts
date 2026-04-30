import dayjs from 'dayjs';

import { ApiError } from '@/lib/apiClient';
import { RawMentorTimeslot, segmentToRaw } from '@/lib/profile/scheduleHelpers';

import {
  deleteMentorSchedule,
  fetchMentorSchedule,
  saveMentorSchedule,
  TimeSlotDTO,
} from './schedule';
import {
  cacheKey,
  readCache,
  readInflight,
  trackInflight,
  writeCache,
} from './scheduleCache';

export interface ScheduleMonthRef {
  userId: string;
  year: number;
  month: number; // 1-12
}

export type SyncFailureReason = 'conflict' | 'unknown';

/** Internal — syncMonthSchedule passes raws back to the hook on success. */
export type SyncOutcome =
  | { ok: true; raws: RawMentorTimeslot[] }
  | { ok: false; reason: SyncFailureReason; message: string };

/** Public — surfaced to UI; success has no payload. */
export type SyncResult =
  | { ok: true }
  | { ok: false; reason: SyncFailureReason; message: string };

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
 * Returns the cached value (sync, may be undefined) and a deduped promise
 * that resolves to fresh data and writes it to cache. Callers should hydrate
 * with `cached` immediately and update from `revalidate` when it differs.
 */
export function loadMonthScheduleCached(ref: ScheduleMonthRef): {
  cached: RawMentorTimeslot[] | undefined;
  revalidate: Promise<RawMentorTimeslot[]>;
} {
  const key = cacheKey(ref);
  const cached = readCache(key);

  let revalidate = readInflight(key);
  if (!revalidate) {
    revalidate = trackInflight(
      key,
      loadMonthSchedule(ref).then((raws) => {
        writeCache(key, raws);
        return raws;
      })
    );
  }

  return { cached, revalidate };
}

/** Force a network fetch and write the result to cache, bypassing any cache hit. */
export async function loadMonthScheduleFresh(
  ref: ScheduleMonthRef
): Promise<RawMentorTimeslot[]> {
  const raws = await loadMonthSchedule(ref);
  writeCache(cacheKey(ref), raws);
  return raws;
}

/**
 * Fire-and-forget background fetch that populates cache for a month.
 * No-op when the month is already cached or a request is in flight.
 * Failures are silenced — prefetch must never disrupt the user.
 */
export function prefetchMonthSchedule(ref: ScheduleMonthRef): void {
  const key = cacheKey(ref);
  if (readCache(key) !== undefined) return;
  if (readInflight(key) !== undefined) return;

  trackInflight(
    key,
    loadMonthSchedule(ref).then((raws) => {
      writeCache(key, raws);
      return raws;
    })
  ).catch(() => {
    // Silent: prefetch failures shouldn't surface to the user.
  });
}

/**
 * PUT all upsert slots, DELETE all removed ids, then reload the month.
 *
 * Returns SyncResult — on failure the caller can surface `message` (raw
 * backend `msg`, e.g. "There is 1 conflict in 2026/5") and `reason` to map
 * to user-friendly UI copy. PUT failure aborts before DELETE so we don't
 * partially mutate the schedule.
 */
export async function syncMonthSchedule(params: {
  ref: ScheduleMonthRef;
  upsertPayload: TimeSlotDTO[];
  deleteIds: number[];
}): Promise<SyncOutcome> {
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
      await saveMentorSchedule({
        userId: ref.userId,
        until: endOfMonthUnix,
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

export interface MonthSyncRequest {
  ref: ScheduleMonthRef;
  upsertPayload: TimeSlotDTO[];
  deleteIds: number[];
}

export interface MonthSyncResult {
  /** 'YYYY-MM' for the corresponding request's ref. */
  monthKey: string;
  outcome: SyncOutcome;
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
    const monthKey = `${req.ref.year}-${String(req.ref.month).padStart(2, '0')}`;
    const outcome = await syncMonthSchedule(req);
    results.push({ monthKey, outcome });
  }
  return results;
}
