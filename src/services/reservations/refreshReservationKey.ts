import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import {
  type ScheduleReadKey,
  scheduleReadModel,
} from '@/lib/mentor-schedule/scheduleReadModel';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  type ReservationReadKey,
  reservationReadModel,
} from '@/lib/reservation/reservationReadModel';
import { loadMonthSchedule } from '@/services/mentor-schedule/sync';

import {
  fetchAllReservationsForState,
  fetchReservations,
} from './reservationService';

dayjs.extend(utc);

export function isAbortSignalTriggered(
  err: unknown,
  signal?: AbortSignal
): boolean {
  if (signal?.aborted) return true;
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Internal write-path synchronization helper for `ReservationReadModel`.
 * Unsubscribed slices are dropped with 0 network calls; actively subscribed
 * slices are refreshed in place via `AsyncReadManager.refresh` with an
 * `AbortSignal` so account-switch `clear()` cancels in-flight refreshes.
 */
export function refreshReservationKey(key: ReservationReadKey): Promise<void> {
  return reservationReadModel.invalidateOrRefresh(
    key,
    async (targetKey, signal) => {
      try {
        if (targetKey.endOfMonthUnix !== undefined) {
          const items = await fetchAllReservationsForState(
            targetKey.userId,
            targetKey.state,
            targetKey.endOfMonthUnix,
            signal
          );
          return { items, next_dtend: 0 };
        }
        return await fetchReservations({
          userId: targetKey.userId,
          state: targetKey.state,
          signal,
        });
      } catch (err) {
        if (!isAbortSignalTriggered(err, signal)) {
          captureFlowFailure({
            flow: 'reservation_mutation_invalidate',
            step: `refresh_${targetKey.state}`,
            message: err instanceof Error ? err.message : String(err),
            level: 'warning',
          });
        }
        throw err;
      }
    }
  );
}

/**
 * Synchronize the affected `(mentorId, year, month)` slice(s) in
 * `MentorScheduleReadModel` after a reservation booking or status transition
 * (`createReservation`, `acceptReservation`, `rejectOrCancelReservation`).
 *
 * Computes `{ year, month }` in both `dayjs.utc(dtstart * 1000)` and local
 * `dayjs(dtstart * 1000)` and deduplicates by `${year}-${month}` so
 * cross-timezone month boundaries (e.g. UTC vs. Asia/Taipei) safely
 * synchronize both candidate month slices.
 */
export async function refreshMentorScheduleForReservation(
  mentorId: string | number | undefined,
  dtstart: number | undefined
): Promise<void> {
  if (
    mentorId == null ||
    String(mentorId).trim() === '' ||
    typeof dtstart !== 'number' ||
    !Number.isFinite(dtstart) ||
    dtstart <= 0
  ) {
    return;
  }

  const userId = String(mentorId);
  const utcDate = dayjs.utc(dtstart * 1000);
  const localDate = dayjs(dtstart * 1000);

  const refsByMonth = new Map<string, ScheduleReadKey>();
  for (const date of [utcDate, localDate]) {
    const year = date.year();
    const month = date.month() + 1;
    const monthKey = `${year}-${month}`;
    if (!refsByMonth.has(monthKey)) {
      refsByMonth.set(monthKey, { userId, year, month });
    }
  }

  await Promise.all(
    Array.from(refsByMonth.values()).map((ref) =>
      scheduleReadModel.invalidateOrRefresh(ref, async (signal) => {
        try {
          return await loadMonthSchedule(ref, signal);
        } catch (err) {
          if (!isAbortSignalTriggered(err, signal)) {
            captureFlowFailure({
              flow: 'reservation_mutation_invalidate',
              step: 'refresh_mentor_schedule',
              message: err instanceof Error ? err.message : String(err),
              level: 'warning',
            });
          }
          throw err;
        }
      })
    )
  );
}
