import dayjs from 'dayjs';

import { apiClient, ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { sortPendingFeedbackOldestFirst } from '@/lib/reservation/pendingFeedbackGuard';
import {
  MENTOR_SCHEDULE_RESERVATIONS_TTL_MS,
  type ReservationReadKey,
  reservationReadModel,
} from '@/lib/reservation/reservationReadModel';
import {
  formatExperience,
  resolveCounterpartyProfile,
} from '@/lib/reservation/resolveCounterparty';
import { classifyReservationMessages } from '@/lib/reservation/resolveReservationMessages';
import { components } from '@/types/api';
import { Reservation, ReservationMessage } from '@/types/reservation';
import type {
  RawPendingFeedbackItem,
  RawPendingFeedbackResponse,
  RawReservationFeedback,
  ReservationFeedback,
  SubmitReservationFeedbackRequest,
  UpdateReservationFeedbackRequest,
} from '@/types/reservationFeedback';

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

// `version` (optimistic-lock field, X-Talent-Backend PR #44) and `feedback`
// (post-meeting feedback contract, X-Tracker #730 / #760) are extended locally
// rather than hand-editing the auto-generated src/types/api.ts.
type ReservationInfoVOWithVersion =
  components['schemas']['ReservationInfoVO'] & {
    version?: number;
    cancelled_by?: 'MENTEE' | 'MENTOR' | 'SYSTEM' | null;
    feedback?: RawReservationFeedback | null;
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

export function formatPendingFeedbackDateTime(dtstart: number, dtend: number) {
  const start = dayjs.unix(dtstart);
  const safeDtend =
    typeof dtend === 'number' && Number.isFinite(dtend) && dtend > 0
      ? dtend
      : dtstart;
  const end = dayjs.unix(safeDtend);
  return {
    date: start.format('YYYY/MM/DD'),
    time: `${start.format('HH:mm')}–${end.format('HH:mm')}`,
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

function mapReservationFeedback(
  raw: RawReservationFeedback | null | undefined
): ReservationFeedback | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const meetingHappened =
    typeof raw.meeting_happened === 'boolean' ? raw.meeting_happened : null;

  const rawRating = raw.rating;
  const rating =
    rawRating &&
    typeof rawRating === 'object' &&
    typeof rawRating.rating === 'number' &&
    Number.isFinite(rawRating.rating)
      ? {
          rating: rawRating.rating,
          content:
            typeof rawRating.content === 'string' ? rawRating.content : '',
          createdAt:
            typeof rawRating.created_at === 'number' ? rawRating.created_at : 0,
          updatedAt:
            typeof rawRating.updated_at === 'number' ? rawRating.updated_at : 0,
          authorName:
            typeof rawRating.author_name === 'string'
              ? rawRating.author_name
              : null,
          isPublic: rawRating.is_public !== false,
        }
      : null;

  const nextStep =
    raw.next_step === 'ANSWER' || raw.next_step === 'RATE'
      ? raw.next_step
      : null;

  return {
    meetingHappened,
    rating,
    nextStep,
  };
}

export function mapToReservation(
  reservation: ReservationInfoVOWithVersion,
  myUserId?: string | number | null
): Reservation {
  const { name, avatar, roleLine, cancelledBy, viewerRole } =
    resolveCounterpartyProfile(reservation, myUserId);
  const { date, time } = formatDateTime(reservation.dtstart, reservation.dtend);
  const feedback = mapReservationFeedback(reservation.feedback);

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

  const rawMessages: ReservationMessage[] = [];
  for (const message of reservation.messages ?? []) {
    if (typeof message.content !== 'string') continue;
    const trimmed = message.content.trim();
    if (trimmed.length === 0) continue;
    const role = classifyMessageRole(message, userIdToRole);
    const item: ReservationMessage = role
      ? { content: trimmed, role }
      : { content: trimmed };
    rawMessages.push(item);
  }

  const { messages, menteeMessage, mentorMessage, cancelReasonMessage } =
    classifyReservationMessages(rawMessages, cancelledBy);

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
    ...(cancelReasonMessage ? { cancelReasonMessage } : {}),
    scheduleId: reservation.schedule_id,
    dtstart: reservation.dtstart,
    dtend: reservation.dtend,
    senderUserId: reservation.sender?.user_id ?? 0,
    participantUserId: reservation.participant?.user_id ?? 0,
    cancelledBy,
    viewerRole,
    version: reservation.version ?? 0,
    ...(feedback ? { feedback } : {}),
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
  const data = await apiClient.getUnwrapped<
    components['schemas']['ReservationInfoListVO']
  >(path, {
    params: { state, batch, next_dtend: nextDtend },
    signal,
  });

  if (debug) console.debug('[reservations] GET parsed', data);

  const items = (data?.reservations ?? []).map((reservation) =>
    mapToReservation(reservation, userId)
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
 * Read-model invalidation (write path)
 * ================================ */

/**
 * Invalidate the cached reservation page at `key` after a write
 * (accept/reject/cancel/create - see `reservationMutations.ts` and
 * `createReservation` below) whose effect may have landed there, so the
 * write path owns its own cache freshness instead of every caller
 * re-deriving what to invalidate (X-Tracker #651).
 *
 * A key with an active subscriber (most commonly the reservation
 * dashboard, which subscribes to every tab for as long as it's mounted) is
 * refreshed in place with a fresh fetch instead of being dropped via
 * `invalidate()` - that would notify the subscriber with `data: null` and
 * blank a tab the mutation never touched. A key with no active subscriber
 * is simply invalidated: nothing is watching it, so the next `subscribe()`
 * (e.g. navigating back to a route that reads it) fetches fresh on its own
 * instead of paying for a background fetch nobody is watching.
 */
export function invalidateReservationRead(key: ReservationReadKey): void {
  for (const targetKey of reservationReadModel.getMatchingKeys(key)) {
    if (!reservationReadModel.hasSubscribers(targetKey)) {
      reservationReadModel.invalidate(targetKey);
      continue;
    }
    if (targetKey.endOfMonthUnix !== undefined) {
      const endOfMonthUnix = targetKey.endOfMonthUnix;
      fetchAllReservationsForState(
        targetKey.userId,
        targetKey.state,
        endOfMonthUnix
      )
        .then((items) => {
          reservationReadModel.set(
            targetKey,
            { items, next_dtend: 0 },
            MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
          );
        })
        .catch((err) => {
          captureFlowFailure({
            flow: 'reservation_mutation_invalidate',
            step: `refresh_${targetKey.state}`,
            message: err instanceof Error ? err.message : String(err),
            level: 'warning',
          });
        });
      continue;
    }
    fetchReservations({ userId: targetKey.userId, state: targetKey.state })
      .then((result) => {
        reservationReadModel.set(targetKey, result);
      })
      .catch((err) => {
        captureFlowFailure({
          flow: 'reservation_mutation_invalidate',
          step: `refresh_${targetKey.state}`,
          message: err instanceof Error ? err.message : String(err),
          level: 'warning',
        });
      });
  }
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
  const data = await apiClient.putUnwrapped<
    components['schemas']['ReservationVO']
  >(path, body);

  if (debug) console.debug('[reservations] PUT parsed', data);

  if (!data) throw new Error('API error: missing data in response');

  return data;
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
  const data = await apiClient.postUnwrapped<
    components['schemas']['ReservationVO']
  >(path, body);

  if (debug) console.debug('[reservations] POST parsed', data);

  if (!data) throw new Error('API error: missing data in response');

  // A new booking lands in PENDING for both sides: the mentee who just
  // booked (`userId`) and the mentor being booked (`body.user_id`) - see
  // invalidateReservationRead above.
  invalidateReservationRead({
    userId: String(userId),
    state: 'MENTEE_PENDING',
  });
  invalidateReservationRead({
    userId: String(body.user_id),
    state: 'MENTOR_PENDING',
  });

  return data;
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

type PendingFeedbackCandidate =
  ReservationInfoVOWithVersion | RawPendingFeedbackItem;

function isFullReservationInfoVO(
  item: PendingFeedbackCandidate
): item is ReservationInfoVOWithVersion {
  return 'sender' in item || 'participant' in item;
}

function extractRawPendingFeedbackList(
  data:
    | RawPendingFeedbackResponse
    | ReservationInfoVOWithVersion[]
    | null
    | undefined
): PendingFeedbackCandidate[] {
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (typeof data === 'object') {
    if (Array.isArray(data.reservations)) {
      return data.reservations;
    }
    if (Array.isArray(data.items)) {
      return data.items;
    }
  }
  return [];
}

function mapPendingFeedbackCandidate(
  candidate: PendingFeedbackCandidate,
  userId: string | number,
  fallbackViewerRole?: 'MENTEE' | 'MENTOR'
): Reservation | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  if (isFullReservationInfoVO(candidate)) {
    const mapped = mapToReservation(candidate, userId);
    if (!mapped.id || mapped.cancelledBy) {
      return null;
    }
    if (
      candidate.feedback &&
      candidate.feedback.next_step === null &&
      candidate.feedback.meeting_happened !== null
    ) {
      return null;
    }
    const formattedDateTime =
      mapped.dtstart > 0
        ? formatPendingFeedbackDateTime(mapped.dtstart, mapped.dtend)
        : undefined;
    return {
      ...mapped,
      ...(formattedDateTime ?? {}),
      viewerRole: mapped.viewerRole ?? fallbackViewerRole,
      feedback: mapped.feedback ?? {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    };
  }

  if (candidate.cancelled_by) {
    return null;
  }
  if (
    candidate.feedback &&
    candidate.feedback.next_step === null &&
    candidate.feedback.meeting_happened !== null
  ) {
    return null;
  }

  const rawId = candidate.id ?? candidate.reservation_id;
  if (rawId === undefined || rawId === null || String(rawId).trim() === '') {
    return null;
  }

  const dtstart =
    typeof candidate.dtstart === 'number' && Number.isFinite(candidate.dtstart)
      ? candidate.dtstart
      : 0;
  const dtend =
    typeof candidate.dtend === 'number' && Number.isFinite(candidate.dtend)
      ? candidate.dtend
      : dtstart;
  const { date, time } =
    dtstart > 0
      ? formatPendingFeedbackDateTime(dtstart, dtend)
      : formatDateTime(dtstart, dtend);

  const rawRole = candidate.viewer_role ?? candidate.role ?? fallbackViewerRole;
  const viewerRole: 'MENTEE' | 'MENTOR' | undefined =
    rawRole === 'MENTOR' || rawRole === 'MENTEE' ? rawRole : undefined;

  const counterparty = candidate.counterparty;
  const name =
    counterparty?.name?.trim() || candidate.counterparty_name?.trim() || '—';
  const avatar =
    counterparty?.avatar ?? candidate.counterparty_avatar ?? undefined;
  const roleLine = [
    counterparty?.job_title?.trim() || '',
    formatExperience(counterparty?.years_of_experience),
  ]
    .filter(Boolean)
    .join(', ');

  const myNumericId = Number(userId);
  const resolvedMyId = Number.isFinite(myNumericId) ? myNumericId : 0;
  const counterpartyUserId =
    typeof counterparty?.user_id === 'number' ? counterparty.user_id : 0;

  const senderUserId =
    viewerRole === 'MENTOR' ? counterpartyUserId : resolvedMyId;
  const participantUserId =
    viewerRole === 'MENTOR' ? resolvedMyId : counterpartyUserId;

  const mappedFeedback = mapReservationFeedback(candidate.feedback);

  return {
    id: String(rawId),
    name,
    roleLine,
    date,
    time,
    avatar,
    messages: [],
    scheduleId: candidate.schedule_id ?? 0,
    dtstart,
    dtend,
    senderUserId,
    participantUserId,
    viewerRole,
    version: candidate.version ?? 0,
    feedback: mappedFeedback ?? {
      meetingHappened: null,
      rating: null,
      nextStep: 'ANSWER',
    },
  };
}

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

    const rawList = extractRawPendingFeedbackList(data);
    const seenIds = new Set<string>();
    const mappedItems: Reservation[] = [];

    for (const rawItem of rawList) {
      const mapped = mapPendingFeedbackCandidate(
        rawItem,
        userId,
        fallbackViewerRole
      );
      if (!mapped || seenIds.has(mapped.id)) {
        continue;
      }
      seenIds.add(mapped.id);
      mappedItems.push(mapped);
    }

    return sortPendingFeedbackOldestFirst(mappedItems);
  } catch (err) {
    if (
      signal?.aborted ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
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

/* ================================
 * POST: Submit meeting feedback
 * ================================ */

export async function postReservationFeedback(opts: {
  userId: string | number;
  reservationId: string | number;
  body: SubmitReservationFeedbackRequest;
  debug?: boolean;
}): Promise<unknown> {
  const { userId, reservationId, body, debug } = opts;

  if (debug) {
    console.debug('[reservations] POST Feedback request', {
      userId,
      reservationId,
    });
  }

  const path = `/v1/users/${encodeURIComponent(userId)}/reservations/${encodeURIComponent(reservationId)}/feedback`;
  return apiClient.postUnwrapped<unknown>(path, body);
}

/* ================================
 * PUT: Update meeting feedback (#731)
 * ================================ */

export async function putReservationFeedback(opts: {
  userId: string | number;
  reservationId: string | number;
  body: UpdateReservationFeedbackRequest;
  debug?: boolean;
}): Promise<unknown> {
  const { userId, reservationId, body, debug } = opts;

  if (debug) {
    console.debug('[reservations] PUT Feedback request', {
      userId,
      reservationId,
    });
  }

  const path = `/v1/users/${encodeURIComponent(userId)}/reservations/${encodeURIComponent(reservationId)}/feedback`;
  return apiClient.putUnwrapped<unknown>(path, body);
}
