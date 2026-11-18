import { apiClient, ApiError } from '@/lib/apiClient';
import { isAbortError } from '@/lib/errorUtils';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  extractRawPendingFeedbackList,
  formatDateTime,
  formatPendingFeedbackDateTime,
  mapPendingFeedbackCandidate,
  mapToReservation,
  type PendingFeedbackCandidate,
  projectPendingFeedbackList,
  projectReservation,
  type ReservationInfoVOWithVersion,
} from '@/lib/reservation/reservationProjection';
import { components } from '@/types/api';
import { Reservation } from '@/types/reservation';
import type { RawPendingFeedbackResponse } from '@/types/reservationFeedback';

export {
  extractRawPendingFeedbackList,
  formatDateTime,
  formatPendingFeedbackDateTime,
  mapPendingFeedbackCandidate,
  mapToReservation,
  type PendingFeedbackCandidate,
  projectPendingFeedbackList,
  projectReservation,
  type ReservationInfoVOWithVersion,
};

export type ReservationState =
  | 'MENTOR_UPCOMING'
  | 'MENTOR_PENDING'
  | 'MENTEE_UPCOMING'
  | 'MENTEE_PENDING'
  | 'MENTOR_HISTORY'
  | 'MENTEE_HISTORY';

export type FetchOptions = {
  userId: string | number;
  state: ReservationState;
  batch?: number;
  nextDtend?: number;
  debug?: boolean;
  signal?: AbortSignal;
};

/* ================================
 * Queries
 * ================================ */

export async function fetchReservations(
  opts: FetchOptions
): Promise<{ items: Reservation[]; next_dtend: number }> {
  const { userId, state, batch = 10, nextDtend, debug, signal } = opts;

  if (debug)
    console.debug('[reservations] GET', { userId, state, batch, nextDtend });

  const path = `/v1/users/${userId}/reservations`;
  const data = await apiClient.getUnwrapped<
    components['schemas']['ReservationInfoListVO']
  >(path, {
    params: { state, batch, next_dtend: nextDtend },
    signal,
  });

  if (debug) console.debug('[reservations] GET parsed', data);

  const items = (data?.reservations ?? []).map((reservation) =>
    projectReservation(reservation, userId)
  );
  return { items, next_dtend: data?.next_dtend ?? 0 };
}

// Hard ceiling on pages fetched per state (batch=20 → up to 1,000
// reservations for one month, far beyond any realistic mentor's booking
// volume). Backstops the next_dtend-based guards below in case the backend
// ever returns a cursor that inches forward without repeating or crossing
// endOfMonthUnix, which would otherwise page indefinitely.
const MAX_PAGES = 50;

/**
 * Fetch every reservation for `state` up to (but not including) `endOfMonthUnix`,
 * paging via `next_dtend` until the backend signals no more pages (`next_dtend
 * === 0`), the returned cursor moves past the end of the target month, the
 * cursor repeats (a stuck-cursor guard against an infinite loop), or
 * MAX_PAGES is reached. Non-abort failures are reported via captureFlowFailure
 * and rethrown so callers (`useMentorSchedule`) hold `reservationsLoaded === false`.
 */
export async function fetchAllReservationsForState(
  userId: string,
  state: ReservationState,
  endOfMonthUnix: number,
  signal?: AbortSignal
): Promise<Reservation[]> {
  let allItems: Reservation[] = [];
  let nextDtend: number | undefined = undefined;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetchReservations({
        userId,
        state,
        nextDtend,
        batch: 20,
        signal,
      });
      allItems = [...allItems, ...res.items];
      if (
        res.items.length === 0 ||
        res.next_dtend === 0 ||
        res.next_dtend >= endOfMonthUnix ||
        res.next_dtend === nextDtend
      ) {
        break;
      }
      nextDtend = res.next_dtend;
      if (page === MAX_PAGES - 1) {
        captureFlowFailure({
          flow: 'mentor_schedule_reservations_fetch',
          step: `fetch_${state}_max_pages_exceeded`,
          message: `Aborted after ${MAX_PAGES} pages; cursor still advancing (next_dtend=${nextDtend}).`,
        });
      }
    }
  } catch (err) {
    if (!isAbortError(err, signal)) {
      captureFlowFailure({
        flow: 'mentor_schedule_reservations_fetch',
        step: `fetch_${state}`,
        message: err instanceof Error ? err.message : String(err),
      });
      console.error(
        `[reservationService] Failed to fetch reservations for ${state}:`,
        err
      );
    }
    throw err;
  }
  return allItems;
}

/* ================================
 * GET: Get Google Meet link
 * ================================ */

export async function fetchReservationMeetLink(opts: {
  userId: string | number;
  reservationId: string | number;
  debug?: boolean;
}): Promise<components['schemas']['MeetLinkVO']> {
  const { userId, reservationId, debug } = opts;

  if (debug) {
    console.debug('[reservations] GET Meet Link request', {
      userId,
      reservationId,
    });
  }

  const path = `/v1/users/${encodeURIComponent(userId)}/reservations/${encodeURIComponent(reservationId)}/google-meet`;
  const data =
    await apiClient.getUnwrapped<components['schemas']['MeetLinkVO']>(path);

  if (debug) {
    console.debug('[reservations] GET Meet Link parsed', data);
  }

  if (!data) {
    throw new Error('API error: missing data in response');
  }

  return data;
}

/* ================================
 * GET: Pending meeting feedback queue (#740)
 * ================================ */

export async function fetchPendingFeedbackReservations(opts: {
  userId: string | number;
  fallbackViewerRole?: 'MENTEE' | 'MENTOR';
  signal?: AbortSignal;
  debug?: boolean;
}): Promise<Reservation[]> {
  const { userId, fallbackViewerRole, signal, debug } = opts;

  if (!userId) {
    return [];
  }

  const path = `/v1/users/${encodeURIComponent(userId)}/reservations/pending-feedback`;

  try {
    const data = await apiClient.getUnwrapped<
      RawPendingFeedbackResponse | ReservationInfoVOWithVersion[] | null
    >(path, { signal });

    if (debug) {
      console.debug('[reservations] GET pending-feedback response', data);
    }

    return projectPendingFeedbackList(data, userId, fallbackViewerRole);
  } catch (err) {
    if (isAbortError(err, signal)) {
      return [];
    }

    // Graceful fallback when backend #760 route is not yet deployed (404).
    if (err instanceof ApiError && err.status === 404) {
      return [];
    }

    if (err instanceof ApiError && err.status >= 500) {
      captureFlowFailure({
        flow: 'reservation_pending_feedback',
        step: 'get_pending_feedback',
        level: 'warning',
        message: err.message || 'Failed to fetch pending feedback reservations',
      });
    }

    throw err;
  }
}
