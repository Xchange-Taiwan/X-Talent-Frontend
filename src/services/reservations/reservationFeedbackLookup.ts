import { apiClient, ApiError } from '@/lib/apiClient';
import {
  mapReservationFeedbackDto,
  normalizeCancelledByDto,
  normalizeFeedbackCounterpartDto,
  resolveFeedbackPartyIds,
} from '@/lib/reservation/mapReservationFeedbackDto';
import type { Reservation } from '@/types/reservation';
import type { RawReservationFeedback } from '@/types/reservationFeedback';

import { formatDateTime } from './reservationService';

export interface RawSingleFeedbackCounterpart {
  user_id?: number;
  name?: string | null;
  avatar?: string | null;
  job_title?: string | null;
  company?: string | null;
  years_of_experience?: string | null;
}

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
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const rawId = raw.reservation_id ?? raw.id;
  if (rawId === undefined || rawId === null || String(rawId).trim() === '') {
    return null;
  }

  const normalizedRoleToken = String(raw.role ?? raw.viewer_role ?? '')
    .trim()
    .toUpperCase();
  const upperRole: 'MENTEE' | 'MENTOR' =
    normalizedRoleToken === 'MENTOR'
      ? 'MENTOR'
      : normalizedRoleToken === 'MENTEE'
        ? 'MENTEE'
        : fallbackRole === 'mentor'
          ? 'MENTOR'
          : 'MENTEE';
  const viewerRole: 'mentee' | 'mentor' =
    upperRole === 'MENTOR' ? 'mentor' : 'mentee';

  const { name, avatar, roleLine, counterpartyUserId } =
    normalizeFeedbackCounterpartDto(raw);

  const dtstart =
    typeof raw.dtstart === 'number' && Number.isFinite(raw.dtstart)
      ? raw.dtstart
      : 0;
  const dtend =
    typeof raw.dtend === 'number' && Number.isFinite(raw.dtend)
      ? raw.dtend
      : dtstart;
  const { date, time } = formatDateTime(dtstart, dtend);

  const { senderUserId, participantUserId } = resolveFeedbackPartyIds(
    userId,
    counterpartyUserId,
    upperRole
  );
  const cancelledBy = normalizeCancelledByDto(raw.cancelled_by);
  const feedback = mapReservationFeedbackDto(raw.feedback);

  return {
    viewerRole,
    reservation: {
      id: String(rawId).trim(),
      name,
      roleLine,
      date,
      time,
      avatar,
      messages: [],
      scheduleId: raw.schedule_id ?? 0,
      dtstart,
      dtend,
      senderUserId,
      participantUserId,
      cancelledBy,
      viewerRole: upperRole,
      version: raw.version ?? 0,
      ...(feedback ? { feedback } : {}),
    },
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
