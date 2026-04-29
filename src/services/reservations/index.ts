import dayjs from 'dayjs';

import { TotalWorkSpanEnum } from '@/components/onboarding/steps/constant';
import {
  Reservation,
  ReservationMessage,
} from '@/components/reservation/types';
import { apiClient } from '@/lib/apiClient';
import { components } from '@/types/api';

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
};

/* ================================
 * Helpers
 * ================================ */

export function formatExperience(yearsOfExperience?: string | null) {
  return (
    TotalWorkSpanEnum[yearsOfExperience as keyof typeof TotalWorkSpanEnum] ?? ''
  );
}

export function formatDateTime(dtstart: number, dtend: number) {
  const start = dayjs.unix(dtstart);
  const end = dayjs.unix(dtend);
  return {
    date: start.format('ddd, MMM DD, YYYY'),
    time: `${start.format('h:mm a')} – ${end.format('h:mm a')}`,
  };
}

/* ================================
 * Mapping
 * ================================ */

// Classify a single API message as MENTEE / MENTOR / unknown.
// Trust the message's own role first (most authoritative); fall back to mapping
// the message's user_id back to sender / participant role.
function classifyMessageRole(
  message: components['schemas']['ReservationMessageVO'],
  userIdToRole: Map<string, string | null | undefined>
): 'MENTEE' | 'MENTOR' | undefined {
  if (message.role === 'MENTEE' || message.role === 'MENTOR')
    return message.role;
  const fallback =
    message.user_id != null
      ? userIdToRole.get(String(message.user_id))
      : undefined;
  if (fallback === 'MENTEE' || fallback === 'MENTOR') return fallback;
  return undefined;
}

export function mapToReservation(
  reservation: components['schemas']['ReservationInfoVO']
): Reservation {
  // API 固定結構：sender = 當前使用者，participant = 對方
  const counterparty = reservation.participant;
  const { date, time } = formatDateTime(reservation.dtstart, reservation.dtend);
  const roleLine = [
    counterparty.job_title?.trim() || '',
    formatExperience(counterparty.years_of_experience),
  ]
    .filter(Boolean)
    .join(', ');

  // Preserve the full conversation in API order so the detail view can render
  // the entire thread, while also tracking the latest message per side for the
  // card preview (which still wants both the mentee's question and the
  // mentor's reply / cancellation reason at a glance).
  const userIdToRole = new Map<string, string | null | undefined>([
    [String(reservation.sender.user_id ?? ''), reservation.sender.role],
    [
      String(reservation.participant.user_id ?? ''),
      reservation.participant.role,
    ],
  ]);

  const messages: ReservationMessage[] = [];
  let menteeMessage: ReservationMessage | undefined;
  let mentorMessage: ReservationMessage | undefined;
  for (const message of reservation.messages ?? []) {
    if (typeof message.content !== 'string') continue;
    const trimmed = message.content.trim();
    if (trimmed.length === 0) continue;
    const role = classifyMessageRole(message, userIdToRole);
    const item: ReservationMessage = role
      ? { content: trimmed, role }
      : { content: trimmed };
    messages.push(item);
    if (role === 'MENTEE') menteeMessage = item;
    else if (role === 'MENTOR') mentorMessage = item;
  }

  // Cancellation badge fires whenever either side rejected/cancelled, with the
  // canceller's role surfaced so the UI can render 「已由導師/學員取消」 on both
  // mentor and mentee history pages. Reject (pre-accept) and cancel
  // (post-accept) intentionally share the same 「取消」 copy per PM scope
  // (Tracker #224). Participant takes precedence when both sides are REJECT.
  const toRole = (r?: string | null): 'MENTEE' | 'MENTOR' | undefined =>
    r === 'MENTEE' || r === 'MENTOR' ? r : undefined;
  const cancelledBy: 'MENTEE' | 'MENTOR' | undefined =
    counterparty.status === 'REJECT'
      ? toRole(counterparty.role)
      : reservation.sender.status === 'REJECT'
        ? toRole(reservation.sender.role)
        : undefined;

  return {
    id: String(reservation.id ?? ''),
    name: counterparty.name || '—',
    roleLine,
    date,
    time,
    avatar: counterparty.avatar ?? undefined,
    messages,
    menteeMessage,
    mentorMessage,
    scheduleId: reservation.schedule_id,
    dtstart: reservation.dtstart,
    dtend: reservation.dtend,
    senderUserId: reservation.sender.user_id ?? 0,
    participantUserId: reservation.participant.user_id ?? 0,
    cancelledBy,
  };
}

/* ================================
 * Queries
 * ================================ */

export async function fetchReservations(
  opts: FetchOptions
): Promise<{ items: Reservation[]; next_dtend: number }> {
  const { userId, state, batch = 10, nextDtend, debug } = opts;

  if (debug)
    console.debug('[reservations] GET', { userId, state, batch, nextDtend });

  const json = await apiClient.get<
    components['schemas']['ApiResponse_ReservationInfoListVO_']
  >(`/v1/users/${userId}/reservations`, {
    params: { state, batch, next_dtend: nextDtend },
  });

  if (debug) console.debug('[reservations] GET parsed', json);

  if (json.code !== '0')
    throw new Error(`API error: code=${json.code}, msg=${json.msg}`);

  const items = (json.data?.reservations ?? []).map((reservation) =>
    mapToReservation(reservation)
  );
  return { items, next_dtend: json.data?.next_dtend ?? 0 };
}

/* ================================
 * PUT: Update reservation status
 * ================================ */

export async function updateReservationStatus(opts: {
  userId: string | number;
  reservationId: string | number;
  body: components['schemas']['UpdateReservationDTO'];
  debug?: boolean;
}): Promise<components['schemas']['ReservationVO']> {
  const { userId, reservationId, body, debug } = opts;

  if (debug)
    console.debug('[reservations] PUT request', {
      userId,
      reservationId,
      body,
    });

  const json = await apiClient.put<
    components['schemas']['ApiResponse_ReservationVO_']
  >(`/v1/users/${userId}/reservations/${reservationId}`, body);

  if (debug) console.debug('[reservations] PUT parsed', json);

  if (json.code !== '0')
    throw new Error(`API error: code=${json.code}, msg=${json.msg}`);

  if (!json.data) throw new Error('API error: missing data in response');

  return json.data;
}

/* ================================
 * POST: Create new reservation
 * ================================ */

/**
 * Create a reservation (POST /v1/users/:user_id/reservations)
 *
 * @param opts.body.previous_reserve - Pass `{ reserve_id: number }` when
 *   rescheduling an existing booking; omit for a fresh reservation.
 */
export async function createReservation(opts: {
  userId: string | number;
  body: components['schemas']['ReservationDTO'];
  debug?: boolean;
}): Promise<components['schemas']['ReservationVO']> {
  const { userId, body, debug } = opts;

  if (debug) console.debug('[reservations] POST request', { userId, body });

  const json = await apiClient.post<
    components['schemas']['ApiResponse_ReservationVO_']
  >(`/v1/users/${userId}/reservations`, body);

  if (debug) console.debug('[reservations] POST parsed', json);

  if (json.code !== '0')
    throw new Error(`API error: code=${json.code}, msg=${json.msg}`);

  if (!json.data) throw new Error('API error: missing data in response');

  return json.data;
}
