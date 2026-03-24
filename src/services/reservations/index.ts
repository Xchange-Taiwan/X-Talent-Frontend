import dayjs from 'dayjs';

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
    years_of_experience:
      | '0'
      | 'ONE'
      | 'TWO'
      | 'THREE_TO_FIVE'
      | 'SIX_TO_TEN'
      | string;
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

function prettyYears(
  exp?: BackendReservation['sender']['years_of_experience']
) {
  switch (exp) {
    case '0':
      return '0 year';
    case 'ONE':
      return '1 year';
    case 'TWO':
      return '2 years';
    case 'THREE_TO_FIVE':
      return '3–5 years';
    case 'SIX_TO_TEN':
      return '6–10 years';
    default:
      return '';
  }
}

function pickCounterparty(r: BackendReservation, state: ReservationState) {
  // 當前使用者是導師時，卡片顯示對方（學員）；反之亦然
  if (state.startsWith('MENTOR_')) return r.participant;
  return r.sender;
}

function formatDateTime(dtstart: number, dtend: number) {
  const start = dayjs.unix(dtstart);
  const end = dayjs.unix(dtend);
  return {
    date: start.format('ddd, MMM DD, YYYY'),
    time: `${start.format('h:mm a')} – ${end.format('h:mm a')}`,
  };
}

/* ================================
 * Frontend view type
 * ================================ */

function mapToReservation(
  r: BackendReservation,
  state: ReservationState
): Reservation {
  const counterparty = pickCounterparty(r, state);
  const { date, time } = formatDateTime(r.dtstart, r.dtend);
  const roleLineParts = [
    counterparty.job_title?.trim() || '',
    prettyYears(counterparty.years_of_experience),
  ].filter(Boolean);

  // Extract the mentee's booking message, shown read-only in the mentor Accept dialog.
  // For MENTOR_* states the backend sets sender = mentor (current user), participant = mentee.
  // For MENTEE_* / HISTORY states the sender is the mentee.
  const menteeUserId = state.startsWith('MENTOR_')
    ? r.participant.user_id
    : r.sender.user_id;
  const senderMessage = r.messages?.find(
    (m) => String(m.user_id) === String(menteeUserId)
  );
  const note = senderMessage?.content ?? undefined;

  return {
    id: String(r.id),
    name: counterparty.name || '—',
    roleLine: roleLineParts.join(', '),
    date,
    time,

    avatar: counterparty.avatar,
    note,
    scheduleId: r.schedule_id,
    dtstart: r.dtstart,
    dtend: r.dtend,

    senderUserId: r.sender.user_id,
    participantUserId: r.participant.user_id,
  };
}

/* ================================
 * Queries
 * ================================ */

// 取得單一 state 的預約清單
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
    console.debug(
      '[reservations] GET Response status',
      res.status,
      res.statusText
    );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (debug) console.debug('[reservations] GET Error body', text);
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  const json = (await res.json()) as BackendResponse;
  if (debug) console.debug('[reservations] GET Parsed JSON', json);

  if (json.code !== '0')
    throw new Error(`API error: code=${json.code}, msg=${json.msg}`);

  const items = (json.data.reservations || []).map((r) =>
    mapToReservation(r, state)
  );
  return { items, next_dtend: json.data?.next_dtend ?? 0 };
}

// 一次抓五個清單（並發）
export async function fetchAllReservationLists(params: {
  userId: string | number;
  accessToken?: string;
  batch?: number;
  debug?: boolean;
}) {
  const { userId, accessToken, batch = 10, debug } = params;

  const [
    upcomingMenteeRes,
    pendingMenteeRes,
    upcomingMentorRes,
    pendingMentorRes,
    historyRes,
  ] = await Promise.all([
    fetchReservations({
      userId,
      state: 'MENTEE_UPCOMING',
      batch,
      accessToken,
      debug,
    }),
    fetchReservations({
      userId,
      state: 'MENTEE_PENDING',
      batch,
      accessToken,
      debug,
    }),
    fetchReservations({
      userId,
      state: 'MENTOR_UPCOMING',
      batch,
      accessToken,
      debug,
    }),
    fetchReservations({
      userId,
      state: 'MENTOR_PENDING',
      batch,
      accessToken,
      debug,
    }),
    fetchReservations({ userId, state: 'HISTORY', batch, accessToken, debug }),
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
  my_user_id: number | string; // 操作者（自己）
  my_status: 'ACCEPT' | 'PENDING' | 'REJECT';
  user_id: number | string; // 對方
  schedule_id: number;
  dtstart: number; // epoch seconds
  dtend: number; // epoch seconds
  messages?: Array<{ user_id: number | string; msg: string }>;
  previous_reserve?: Record<string, unknown> | null;
};

// 依你提供的 response 型別
export type UpdateReservationAPIData = {
  id: number;
  status: 'ACCEPT' | 'PENDING' | 'REJECT' | string;

  my_user_id: number | string;
  my_status: 'ACCEPT' | 'PENDING' | 'REJECT' | string;
  my_role: 'MENTOR' | 'MENTEE' | string;

  user_id: number | string; // 對方
  schedule_id: number;
  dtstart: number;
  dtend: number;

  messages: Array<{ user_id: number | string; msg: string }>;
  previous_reserve: Record<string, unknown>;
};

type ApiResp<T> = { code: string; msg: string; data: T };

/**
 * 更新預約狀態（PUT /v1/users/:user_id/reservations/:reservation_id）
 * 回傳扁平結構（含 id / status / messages / ...）
 */
export async function updateReservationStatus(opts: {
  userId: string | number; // path :user_id（自己）
  reservationId: string | number; // path :reservation_id
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

  if (debug)
    console.debug('[reservations] PUT Request', { url, headers, body });

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (debug)
    console.debug(
      '[reservations] PUT Response status',
      res.status,
      res.statusText
    );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (debug) console.debug('[reservations] PUT Error body', text);
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  const json = (await res.json()) as ApiResp<UpdateReservationAPIData>;
  if (debug) console.debug('[reservations] PUT Parsed JSON', json);

  if (json.code !== '0') {
    throw new Error(`API error: code=${json.code}, msg=${json.msg}`);
  }

  return json.data;
}

/* ================================-
 * POST: Create new reservation
 * ================================- */

export type CreateReservationPayload = {
  my_user_id: number | string;
  my_status: 'ACCEPT' | 'PENDING' | 'REJECT';
  user_id: number | string;
  schedule_id: number;
  dtstart: number; // epoch seconds
  dtend: number; // epoch seconds
  messages: Array<{ user_id: number | string; msg: string }>;
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
  messages: Array<{ user_id: number | string; msg: string }>;
  previous_reserve: { reserve_id: number } | Record<string, never>;
};

/**
 * 新增預約（POST /v1/users/:user_id/reservations）
 *
 * @param opts.body.previous_reserve - 傳入 `{}` 表示新預約；傳入 `{ reserve_id: number }` 表示修改預約
 */
export async function createReservation(opts: {
  userId: string | number; // path :user_id（自己）
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

  if (debug)
    console.debug('[reservations] POST Request', { url, headers, body });

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (debug)
    console.debug(
      '[reservations] POST Response status',
      res.status,
      res.statusText
    );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (debug) console.debug('[reservations] POST Error body', text);
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  const json = (await res.json()) as ApiResp<CreateReservationAPIData>;
  if (debug) console.debug('[reservations] POST Parsed JSON', json);

  if (json.code !== '0') {
    throw new Error(`API error: code=${json.code}, msg=${json.msg}`);
  }

  return json.data;
}
