import dayjs from 'dayjs';

import { TotalWorkSpanEnum } from '@/constant/seniority';
import { apiClient, FetchApiError } from '@/lib/apiClient';
import { Reservation, ReservationMessage } from '@/services/reservations/types';
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

/**
 * Resolve the counterparty based on who is currently logged in.
 * Supports both raw ReservationInfoVO and mapped Reservation objects.
 */
export function resolveCounterparty(
  reservation: components['schemas']['ReservationInfoVO'],
  myUserId?: string | number | null
): {
  name: string;
  avatar?: string;
  roleLine: string;
  cancelledBy?: 'MENTEE' | 'MENTOR';
};

export function resolveCounterparty(
  reservation: Reservation,
  myUserId: string | number
): string | number;

export function resolveCounterparty(
  reservation: components['schemas']['ReservationInfoVO'] | Reservation,
  myUserId?: string | number | null
):
  | {
      name: string;
      avatar?: string;
      roleLine: string;
      cancelledBy?: 'MENTEE' | 'MENTOR';
    }
  | string
  | number {
  if (!reservation) {
    return '';
  }

  // Check if it is a mapped Reservation
  if ('senderUserId' in reservation || 'participantUserId' in reservation) {
    const mappedRes = reservation as Reservation;
    const senderId = mappedRes.senderUserId;
    if (
      senderId != null &&
      myUserId != null &&
      String(myUserId) === String(senderId)
    ) {
      return mappedRes.participantUserId;
    }
    return mappedRes.senderUserId;
  }

  // Otherwise, it is a raw ReservationInfoVO
  const rawRes = reservation as components['schemas']['ReservationInfoVO'];
  const counterparty =
    myUserId == null
      ? (rawRes.participant ?? rawRes.sender)
      : rawRes.sender?.user_id != null &&
          String(myUserId) === String(rawRes.sender.user_id)
        ? (rawRes.participant ?? rawRes.sender)
        : (rawRes.sender ?? rawRes.participant);

  const name = counterparty?.name || '—';
  const avatar = counterparty?.avatar ?? undefined;

  const roleLine = [
    counterparty?.job_title?.trim() || '',
    formatExperience(counterparty?.years_of_experience),
  ]
    .filter(Boolean)
    .join(', ');

  const toRole = (r?: string | null): 'MENTEE' | 'MENTOR' | undefined =>
    r === 'MENTEE' || r === 'MENTOR' ? r : undefined;

  const currentUserSide =
    counterparty === rawRes.participant ? rawRes.sender : rawRes.participant;

  const cancelledBy =
    counterparty?.status === 'REJECT'
      ? toRole(counterparty?.role)
      : currentUserSide?.status === 'REJECT'
        ? toRole(currentUserSide?.role)
        : undefined;

  return {
    name,
    avatar,
    roleLine,
    cancelledBy,
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
  reservation: components['schemas']['ReservationInfoVO'],
  myUserId?: string | number | null
): Reservation {
  const { name, avatar, roleLine, cancelledBy } = resolveCounterparty(
    reservation,
    myUserId
  );
  const { date, time } = formatDateTime(reservation.dtstart, reservation.dtend);

  // Preserve the full conversation in API order so the detail view can render
  // the entire thread, while also tracking the latest message per side for the
  // card preview (which still wants both the mentee's question and the
  // mentor's reply / cancellation reason at a glance).
  const userIdToRole = new Map<string, string | null | undefined>([
    [String(reservation.sender?.user_id ?? ''), reservation.sender?.role],
    [
      String(reservation.participant?.user_id ?? ''),
      reservation.participant?.role,
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

  return {
    id: String(reservation.id ?? ''),
    name,
    roleLine,
    date,
    time,
    avatar,
    messages,
    menteeMessage,
    mentorMessage,
    scheduleId: reservation.schedule_id,
    dtstart: reservation.dtstart,
    dtend: reservation.dtend,
    senderUserId: reservation.sender?.user_id ?? 0,
    participantUserId: reservation.participant?.user_id ?? 0,
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

  const path = `/v1/users/${userId}/reservations`;
  const json = await apiClient.get<
    components['schemas']['ApiResponse_ReservationInfoListVO_']
  >(path, {
    params: { state, batch, next_dtend: nextDtend },
  });

  if (debug) console.debug('[reservations] GET parsed', json);

  if (json.code !== '0') throw new FetchApiError(json.code, json.msg, path);

  const items = (json.data?.reservations ?? []).map((reservation) =>
    mapToReservation(reservation, userId)
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

  const path = `/v1/users/${userId}/reservations/${reservationId}`;
  const json = await apiClient.put<
    components['schemas']['ApiResponse_ReservationVO_']
  >(path, body);

  if (debug) console.debug('[reservations] PUT parsed', json);

  if (json.code !== '0') throw new FetchApiError(json.code, json.msg, path);

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

  const path = `/v1/users/${userId}/reservations`;
  const json = await apiClient.post<
    components['schemas']['ApiResponse_ReservationVO_']
  >(path, body);

  if (debug) console.debug('[reservations] POST parsed', json);

  if (json.code !== '0') throw new FetchApiError(json.code, json.msg, path);

  if (!json.data) throw new Error('API error: missing data in response');

  return json.data;
}
