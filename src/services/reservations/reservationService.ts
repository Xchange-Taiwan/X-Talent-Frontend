import dayjs from 'dayjs';

import { apiClient, FetchApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { resolveCounterpartyProfile } from '@/lib/reservation/resolveCounterparty';
import { components } from '@/types/api';
import { Reservation, ReservationMessage } from '@/types/reservation';

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

// `version` (optimistic-lock field, X-Talent-Backend PR #44) is not yet part
// of the generated OpenAPI schema in src/types/api.ts — that file is
// auto-generated and regenerates once the backend ships the field. Extend
// the generated types locally in the meantime rather than hand-editing api.ts.
type ReservationInfoVOWithVersion =
  components['schemas']['ReservationInfoVO'] & {
    version?: number;
  };
type UpdateReservationDTOWithVersion =
  components['schemas']['UpdateReservationDTO'] & {
    version?: number;
  };

/* ================================
 * Helpers
 * ================================ */

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
  reservation: ReservationInfoVOWithVersion,
  myUserId?: string | number | null
): Reservation {
  const { name, avatar, roleLine, cancelledBy } = resolveCounterpartyProfile(
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
    version: reservation.version ?? 0,
  };
}

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
  const json = await apiClient.get<
    components['schemas']['ApiResponse_ReservationInfoListVO_']
  >(path, {
    params: { state, batch, next_dtend: nextDtend },
    signal,
  });

  if (debug) console.debug('[reservations] GET parsed', json);

  if (json.code !== '0') throw new FetchApiError(json.code, json.msg, path);

  const items = (json.data?.reservations ?? []).map((reservation) =>
    mapToReservation(reservation, userId)
  );
  return { items, next_dtend: json.data?.next_dtend ?? 0 };
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
 * MAX_PAGES is reached. Fetch failures are reported via captureFlowFailure
 * and swallowed, returning whatever pages were already collected rather than
 * throwing.
 */
export async function fetchAllReservationsForState(
  userId: string,
  state: ReservationState,
  endOfMonthUnix: number
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
  return allItems;
}

/* ================================
 * PUT: Update reservation status
 * ================================ */

export async function updateReservationStatus(opts: {
  userId: string | number;
  reservationId: string | number;
  body: UpdateReservationDTOWithVersion;
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
  const json =
    await apiClient.get<components['schemas']['ApiResponse_MeetLinkVO_']>(path);

  if (debug) {
    console.debug('[reservations] GET Meet Link parsed', json);
  }

  if (json.code !== '0') {
    throw new FetchApiError(json.code, json.msg, path);
  }

  if (!json.data) {
    throw new Error('API error: missing data in response');
  }

  return json.data;
}
