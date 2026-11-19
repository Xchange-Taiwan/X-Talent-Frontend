import { apiClient, ApiError } from '@/lib/apiClient';
import { normalizeFeedbackCandidateDto } from '@/lib/reservation/mapReservationFeedbackDto';
import {
  formatDateTime,
  projectFeedbackCandidate,
} from '@/lib/reservation/reservationProjection';
import type { Reservation } from '@/types/reservation';
import type {
  RawPendingFeedbackCounterpart,
  RawReservationFeedback,
} from '@/types/reservationFeedback';

export type RawSingleFeedbackCounterpart = RawPendingFeedbackCounterpart;

export interface RawSingleReservationFeedbackVO {
  reservation_id?: number | string;
  id?: number | string;
  role?: 'MENTEE' | 'MENTOR' | null;
  viewer_role?: 'MENTEE' | 'MENTOR' | null;
  counterpart?: RawSingleFeedbackCounterpart | null;
  counterparty?: RawSingleFeedbackCounterpart | null;
  dtstart: number;
  dtend: number;
  schedule_id?: number;
  version?: number;
  cancelled_by?: 'MENTEE' | 'MENTOR' | 'SYSTEM' | null;
  feedback?: RawReservationFeedback | null;
}

export interface ReservationFeedbackLookupResult {
  viewerRole: 'mentee' | 'mentor';
  reservation: Reservation;
}

/**
 * Maps a single-reservation feedback lookup DTO (#760 §3.2) into the resolved
 * viewer role (`'mentee' | 'mentor'`) and frontend `Reservation` model.
 */
export function mapSingleReservationFeedbackLookup(
  raw: RawSingleReservationFeedbackVO | null | undefined,
  userId: string | number,
  fallbackRole: 'mentee' | 'mentor' = 'mentee'
): ReservationFeedbackLookupResult | null {
  const candidate = normalizeFeedbackCandidateDto(raw, userId, {
    fallbackViewerRole: fallbackRole === 'mentor' ? 'MENTOR' : 'MENTEE',
    preferReservationId: true,
    preferRoleField: true,
  });
  if (!candidate || !candidate.viewerRole) {
    return null;
  }

  return {
    viewerRole: candidate.viewerRole === 'MENTOR' ? 'mentor' : 'mentee',
    reservation: projectFeedbackCandidate(candidate, userId, {
      formatSlotDateTime: formatDateTime,
    }),
  };
}

/**
 * Queries `GET /v1/users/{user_id}/reservations/{reservation_id}/feedback` (#760 §3.2)
 * to determine the caller's role and feedback state for email / cross-page deep links.
 * Returns `null` on 404 or aborted requests.
 */
export async function fetchSingleReservationFeedback(opts: {
  userId: string | number;
  reservationId: string | number;
  fallbackRole?: 'mentee' | 'mentor';
  signal?: AbortSignal;
}): Promise<ReservationFeedbackLookupResult | null> {
  const { userId, reservationId, fallbackRole = 'mentee', signal } = opts;
  const cleanUserId = String(userId ?? '').trim();
  const cleanResId = String(reservationId ?? '').trim();

  if (!cleanUserId || !cleanResId) {
    return null;
  }

  const path = `/v1/users/${encodeURIComponent(cleanUserId)}/reservations/${encodeURIComponent(cleanResId)}/feedback`;

  try {
    const data = await apiClient.getUnwrapped<RawSingleReservationFeedbackVO>(
      path,
      { signal }
    );
    return mapSingleReservationFeedbackLookup(data, cleanUserId, fallbackRole);
  } catch (err) {
    if (
      signal?.aborted ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
      return null;
    }
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}
