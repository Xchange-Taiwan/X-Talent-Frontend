import dayjs from 'dayjs';

import { TotalWorkSpanEnum } from '@/components/onboarding/steps/constant';
import { Reservation } from '@/components/reservation/types';

/* ================================
 * Backend domain types
 * ================================ */

export type BackendReservation = {
  id: number;
  sender: {
    user_id: number | string;
    role: 'MENTOR' | 'MENTEE';
    status: 'ACCEPT' | 'PENDING' | string;
    name: string;
    avatar: string;
    job_title: string;
    years_of_experience: keyof typeof TotalWorkSpanEnum | string;
  };
  participant: BackendReservation['sender'];
  schedule_id: number;
  dtstart: number; // epoch seconds
  dtend: number; // epoch seconds
  previous_reserve: unknown;
  messages: Array<{
    user_id: number | string;
    role: string | null;
    content: string | null;
  }>;
};

export type BackendResponse = {
  code: string;
  msg: string;
  data: {
    reservations: BackendReservation[];
    next_dtend: number;
  };
};

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
  accessToken?: string;
  debug?: boolean;
};

/* ================================
 * Helpers
 * ================================ */

export function formatExperience(
  yearsOfExperience?: BackendReservation['sender']['years_of_experience']
) {
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

export function mapToReservation(
  reservation: BackendReservation,
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

  // Extract the mentee's booking message, shown read-only in the mentor Accept dialog.
  // For MENTOR_* states the backend sets sender = mentor (current user), participant = mentee.
  // For MENTEE_* / HISTORY states the sender is the mentee.
  const menteeUserId = state.startsWith('MENTOR_')
    ? reservation.participant.user_id
    : reservation.sender.user_id;
  const menteeMessage = reservation.messages?.find(
    (message) => String(message.user_id) === String(menteeUserId)
  );

  return {
    id: String(reservation.id),
    name: counterparty.name || '—',
    roleLine,
    date,
    time,
    avatar: counterparty.avatar,
    note: menteeMessage?.content ?? undefined,
    scheduleId: reservation.schedule_id,
    dtstart: reservation.dtstart,
    dtend: reservation.dtend,
    senderUserId: reservation.sender.user_id,
    participantUserId: reservation.participant.user_id,
  };
}

/* ================================
 * Queries
 * ================================ */

export async function fetchReservations(
  opts: FetchOptions
): Promise<{ items: Reservation[]; next_dtend: number }> {
  const { userId, state, batch = 10, nextDtend, accessToken, debug } = opts;

  const query = new URLSearchParams();
  query.set('state', state);
  query.set('batch', String(batch));
  if (typeof nextDtend === 'number') query.set('next_dtend', String(nextDtend));

  const url = `${process.env.NEXT_PUBLIC_API_URL}/v1/users/${userId}/reservations?${query.toString()}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  if (debug) console.debug('[reservations] GET', { url, headers });

  const res = await fetch(url, { method: 'GET', headers });

  if (debug)
    console.debug('[reservations] GET response', res.status, res.statusText);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (debug) console.debug('[reservations] GET error body', text);
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  const json = (await res.json()) as BackendResponse;
  if (debug) console.debug('[reservations] GET parsed', json);

  if (json.code !== '0')
    throw new Error(`API error: code=${json.code}, msg=${json.msg}`);

  const items = (json.data.reservations ?? []).map((reservation) =>
    mapToReservation(reservation, state)
  );
  return { items, next_dtend: json.data?.next_dtend ?? 0 };
}

export type FetchAllReservationListsOptions = {
  userId: string | number;
  accessToken?: string;
  batch?: number;
  debug?: boolean;
};

export async function fetchAllReservationLists(
  opts: FetchAllReservationListsOptions
) {
  const { userId, accessToken, batch = 10, debug } = opts;

  const commonOpts = { userId, batch, accessToken, debug };

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

export type UpdateReservationAPIData = {
  id: number;
  status: 'ACCEPT' | 'PENDING' | 'REJECT' | string;
  my_user_id: number | string;
  my_status: 'ACCEPT' | 'PENDING' | 'REJECT' | string;
  my_role: 'MENTOR' | 'MENTEE' | string;
  user_id: number | string;
  schedule_id: number;
  dtstart: number;
  dtend: number;
  messages: Array<{ user_id: number | string; content: string }>;
  previous_reserve: Record<string, unknown>;
};

type ApiResponse<T> = { code: string; msg: string; data: T };

export async function updateReservationStatus(opts: {
  userId: string | number;
  reservationId: string | number;
  body: UpdateReservationPayload;
  accessToken?: string;
  debug?: boolean;
}): Promise<UpdateReservationAPIData> {
  const { userId, reservationId, body, accessToken, debug } = opts;

  const url = `${process.env.NEXT_PUBLIC_API_URL}/v1/users/${userId}/reservations/${reservationId}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  if (debug) console.debug('[reservations] PUT request', { url, body });

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (debug)
    console.debug('[reservations] PUT response', res.status, res.statusText);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (debug) console.debug('[reservations] PUT error body', text);
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  const json = (await res.json()) as ApiResponse<UpdateReservationAPIData>;
  if (debug) console.debug('[reservations] PUT parsed', json);

  if (json.code !== '0')
    throw new Error(`API error: code=${json.code}, msg=${json.msg}`);

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

export type CreateReservationAPIData = {
  id: number;
  status: 'PENDING' | string;
  my_user_id: number | string;
  my_status: 'ACCEPT' | string;
  user_id: number | string;
  schedule_id: number;
  dtstart: number;
  dtend: number;
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
  accessToken?: string;
  debug?: boolean;
}): Promise<CreateReservationAPIData> {
  const { userId, body, accessToken, debug } = opts;

  const url = `${process.env.NEXT_PUBLIC_API_URL}/v1/users/${userId}/reservations`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  if (debug) console.debug('[reservations] POST request', { url, body });

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (debug)
    console.debug('[reservations] POST response', res.status, res.statusText);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (debug) console.debug('[reservations] POST error body', text);
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  const json = (await res.json()) as ApiResponse<CreateReservationAPIData>;
  if (debug) console.debug('[reservations] POST parsed', json);

  if (json.code !== '0')
    throw new Error(`API error: code=${json.code}, msg=${json.msg}`);

  return json.data;
}
