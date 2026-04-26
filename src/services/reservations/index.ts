import dayjs from 'dayjs';

import { TotalWorkSpanEnum } from '@/components/onboarding/steps/constant';
import {
  CounterpartyMessage,
  Reservation,
} from '@/components/reservation/types';
import { apiClient } from '@/lib/apiClient';
import { components } from '@/types/api';

export type ReservationState =
  | 'MENTOR_UPCOMING'
  | 'MENTOR_PENDING'
  | 'MENTEE_UPCOMING'
  | 'MENTEE_PENDING'
  | 'HISTORY';

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

// Resolve the role of the OTHER party so the UI can label the message
// ("學員留言" vs "Mentor 回覆") without needing extra context. We try the
// message's own role first (most authoritative), then the participant's role
// from the reservation, then fall back to the list state. The state-only
// fallback can't disambiguate HISTORY, hence the upstream defaults.
function resolveCounterpartyRole(
  state: ReservationState,
  participantRole?: string | null,
  apiMessageRole?: string | null
): 'MENTEE' | 'MENTOR' | undefined {
  if (apiMessageRole === 'MENTOR' || apiMessageRole === 'MENTEE')
    return apiMessageRole;
  if (participantRole === 'MENTOR' || participantRole === 'MENTEE')
    return participantRole;
  if (state.startsWith('MENTOR_')) return 'MENTEE';
  if (state.startsWith('MENTEE_')) return 'MENTOR';
  return undefined;
}

export function mapToReservation(
  reservation: components['schemas']['ReservationInfoVO'],
  state: ReservationState
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

  // Pick the latest message authored by the counterparty so the viewer always
  // sees what the OTHER side said (mentee question, mentor accept reply, mentor
  // rejection / cancellation reason — all flow through the same field).
  const counterpartyUserId = counterparty.user_id;
  const counterpartyMessages = (reservation.messages ?? []).filter(
    (message) =>
      message.user_id != null &&
      String(message.user_id) === String(counterpartyUserId) &&
      typeof message.content === 'string' &&
      message.content.trim().length > 0
  );
  const latestCounterparty =
    counterpartyMessages[counterpartyMessages.length - 1];
  const counterpartyRole = resolveCounterpartyRole(
    state,
    counterparty.role,
    latestCounterparty?.role
  );
  const counterpartyMessage: CounterpartyMessage | undefined =
    latestCounterparty && counterpartyRole
      ? {
          role: counterpartyRole,
          content: latestCounterparty.content!.trim(),
        }
      : undefined;

  return {
    id: String(reservation.id ?? ''),
    name: counterparty.name || '—',
    roleLine,
    date,
    time,
    avatar: counterparty.avatar ?? undefined,
    counterpartyMessage,
    scheduleId: reservation.schedule_id,
    dtstart: reservation.dtstart,
    dtend: reservation.dtend,
    senderUserId: reservation.sender.user_id ?? 0,
    participantUserId: reservation.participant.user_id ?? 0,
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
    mapToReservation(reservation, state)
  );
  return { items, next_dtend: json.data?.next_dtend ?? 0 };
}

export type FetchAllReservationListsOptions = {
  userId: string | number;
  batch?: number;
  debug?: boolean;
};

export async function fetchAllReservationLists(
  opts: FetchAllReservationListsOptions
) {
  const { userId, batch = 10, debug } = opts;

  const commonOpts = { userId, batch, debug };

  const [
    upcomingMenteeRes,
    pendingMenteeRes,
    upcomingMentorRes,
    pendingMentorRes,
    historyRes,
  ] = await Promise.all([
    fetchReservations({ ...commonOpts, state: 'MENTEE_UPCOMING' }),
    fetchReservations({ ...commonOpts, state: 'MENTEE_PENDING' }),
    fetchReservations({ ...commonOpts, state: 'MENTOR_UPCOMING' }),
    fetchReservations({ ...commonOpts, state: 'MENTOR_PENDING' }),
    fetchReservations({ ...commonOpts, state: 'HISTORY' }),
  ]);

  return {
    upcomingMentee: upcomingMenteeRes.items,
    pendingMentee: pendingMenteeRes.items,
    upcomingMentor: upcomingMentorRes.items,
    pendingMentor: pendingMentorRes.items,
    history: historyRes.items,
    nextTokens: {
      menteeUpcoming: upcomingMenteeRes.next_dtend,
      menteePending: pendingMenteeRes.next_dtend,
      mentorUpcoming: upcomingMentorRes.next_dtend,
      mentorPending: pendingMentorRes.next_dtend,
      history: historyRes.next_dtend,
    },
  };
}

/* ================================
 * PUT: Update reservation status
 * ================================ */

export type UpdateReservationPayload = {
  my_user_id: number | string;
  my_status: 'ACCEPT' | 'PENDING' | 'REJECT';
  user_id: number | string;
  schedule_id: number;
  dtstart: number; // epoch seconds
  dtend: number; // epoch seconds
  messages?: Array<{ user_id: number | string; content: string }>;
  previous_reserve?: Record<string, unknown> | null;
};

export async function updateReservationStatus(opts: {
  userId: string | number;
  reservationId: string | number;
  body: UpdateReservationPayload;
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

export type CreateReservationPayload = {
  my_user_id: number | string;
  my_status: 'ACCEPT' | 'PENDING' | 'REJECT';
  user_id: number | string;
  schedule_id: number;
  dtstart: number; // epoch seconds
  dtend: number; // epoch seconds
  messages: Array<{ user_id: number | string; content: string }>;
  previous_reserve: { reserve_id: number } | Record<string, never>;
};

/**
 * 新增預約（POST /v1/users/:user_id/reservations）
 *
 * @param opts.body.previous_reserve - 傳入 `{}` 表示新預約；傳入 `{ reserve_id: number }` 表示修改預約
 */
export async function createReservation(opts: {
  userId: string | number;
  body: CreateReservationPayload;
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
