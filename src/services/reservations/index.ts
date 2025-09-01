import dayjs from 'dayjs';

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

export type Reservation = {
  id: string;
  name: string;
  roleLine: string;
  date: string;
  time: string;
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
  if (state.startsWith('MENTOR_')) return r.participant;
  return r.sender;
}

function formatDateTime(epochSec: number) {
  const d = dayjs.unix(epochSec);
  return { date: d.format('ddd, MMM DD, YYYY'), time: d.format('h:mm a') };
}

function mapToReservation(
  r: BackendReservation,
  state: ReservationState
): Reservation {
  const counterparty = pickCounterparty(r, state);
  const { date, time } = formatDateTime(r.dtstart);
  const roleLineParts = [
    counterparty.job_title?.trim() || '',
    prettyYears(counterparty.years_of_experience),
  ].filter(Boolean);

  return {
    id: String(r.id),
    name: counterparty.name || '—',
    roleLine: roleLineParts.join(', '),
    date,
    time,
  };
}

// 單一 state
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

  if (debug) console.debug('[reservations] GET', url);

  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  const json = (await res.json()) as BackendResponse;
  if (json.code !== '0')
    throw new Error(`API error: code=${json.code}, msg=${json.msg}`);

  const items = (json.data.reservations || []).map((r) =>
    mapToReservation(r, state)
  );
  return { items, next_dtend: json.data?.next_dtend ?? 0 };
}

// 一次抓五個清單
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
