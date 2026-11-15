import dayjs from 'dayjs';

import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
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
 * Synchronize the affected `(mentorId, year, month)` slice in
 * `MentorScheduleReadModel` after a reservation booking or status transition
 * (`createReservation`, `acceptReservation`, `rejectOrCancelReservation`).
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
  const date = dayjs(dtstart * 1000);
  const ref = {
    userId: String(mentorId),
    year: date.year(),
    month: date.month() + 1,
  };
  await scheduleReadModel.invalidateOrRefresh(ref, async (signal) => {
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
  });
}
