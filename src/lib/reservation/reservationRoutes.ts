import { FIND_MENTOR_HREF, HOME_HREF } from '@/lib/routes';

export type ReservationRouteRole = 'mentee' | 'mentor';
export type ReservationTabParam = 'pending' | 'upcoming' | 'history';

export const RESERVATION_HISTORY_HREF = '/reservation/history';
export const RESERVATION_MENTEE_HREF = '/reservation/mentee';
export const RESERVATION_MENTOR_HREF = '/reservation/mentor';

export const FEEDBACK_DEEP_LINK_ID_KEYS = [
  'reservationId',
  'reservation_id',
  'feedbackReservationId',
] as const;

export type ReservationIdParamKey = (typeof FEEDBACK_DEEP_LINK_ID_KEYS)[number];

export const FEEDBACK_QUEUE_QUERY_VALUE = 'queue';

export type NotificationSemanticCategory =
  | 'reservation_requested'
  | 'reservation_success'
  | 'reservation_failed'
  | 'reservation_canceled'
  | 'reservation_upcoming'
  | 'feedback_requested'
  | 'attendance_requested'
  | 'feedback_reminder'
  | 'feedback_received'
  | 'unknown';

const VALID_TABS = new Set<ReservationTabParam>([
  'pending',
  'upcoming',
  'history',
]);

const RESERVED_NON_ID_VALUES = new Set([
  'upcoming',
  'pending',
  'history',
  'queue',
  'true',
  'false',
  'open',
]);

// Numeric boolean flags (`?feedback=1`, `?feedback=0`) are ignored only on the
// ambiguous `feedback` query parameter so valid integer reservation IDs like
// `reservationId=1` / `reservation_id=1` / `feedbackReservationId=1` still work.
const FEEDBACK_PARAM_FLAG_VALUES = new Set(['0', '1']);

const FEEDBACK_REMINDER_TYPES = new Set([
  'feedback_reminder',
  'reservation_feedback_reminder',
  'meeting_feedback_reminder',
]);

const FEEDBACK_RECEIVED_TYPES = new Set([
  'feedback_received',
  'reservation_feedback_received',
  'meeting_feedback_received',
]);

function normalizeCandidateId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (RESERVED_NON_ID_VALUES.has(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

export function getReservationRolePathname(
  role: ReservationRouteRole
): typeof RESERVATION_MENTEE_HREF | typeof RESERVATION_MENTOR_HREF {
  return role === 'mentor' ? RESERVATION_MENTOR_HREF : RESERVATION_MENTEE_HREF;
}

/**
 * Extracts a target reservation ID from URL query parameters for post-meeting
 * reminder email & in-app notification deep links (#733 / #906).
 */
export function extractDeepLinkReservationId(
  searchParams: Pick<URLSearchParams, 'get'>
): string | null {
  for (let i = 0; i < FEEDBACK_DEEP_LINK_ID_KEYS.length; i += 1) {
    const key = FEEDBACK_DEEP_LINK_ID_KEYS[i];
    const candidate = normalizeCandidateId(searchParams.get(key));
    if (candidate) {
      return candidate;
    }
  }

  // Also support `?tab=history&feedback=<reservationId>` while ignoring
  // `?feedback=queue` and legacy boolean-like flag values (`?feedback=1`)
  const feedbackCandidate = normalizeCandidateId(searchParams.get('feedback'));
  if (
    feedbackCandidate &&
    FEEDBACK_PARAM_FLAG_VALUES.has(feedbackCandidate.toLowerCase())
  ) {
    return null;
  }
  return feedbackCandidate;
}

export function isFeedbackQueueQueryRequested(
  searchParams: Pick<URLSearchParams, 'get'>
): boolean {
  const raw = searchParams.get('feedback');
  return raw?.trim().toLowerCase() === FEEDBACK_QUEUE_QUERY_VALUE;
}

export interface ParsedReservationSearchParams {
  tab: ReservationTabParam | null;
  deepLinkReservationId: string | null;
  isFeedbackQueue: boolean;
}

export function parseReservationSearchParams(
  input: string | Pick<URLSearchParams, 'get'>
): ParsedReservationSearchParams {
  const reader = typeof input === 'string' ? new URLSearchParams(input) : input;
  const rawTab = reader.get('tab')?.trim().toLowerCase() ?? '';
  const tab = VALID_TABS.has(rawTab as ReservationTabParam)
    ? (rawTab as ReservationTabParam)
    : null;

  return {
    tab,
    deepLinkReservationId: extractDeepLinkReservationId(reader),
    isFeedbackQueue: isFeedbackQueueQueryRequested(reader),
  };
}

/**
 * Removes single-use feedback deep-link query parameters while preserving
 * `tab` (and `feedback=queue` when unrelated to a single-session deep link).
 */
export function stripDeepLinkQueryParams(searchString: string): string {
  const params = new URLSearchParams(searchString);
  for (let i = 0; i < FEEDBACK_DEEP_LINK_ID_KEYS.length; i += 1) {
    params.delete(FEEDBACK_DEEP_LINK_ID_KEYS[i]);
  }

  const feedbackParam = params.get('feedback');
  if (
    feedbackParam !== null &&
    feedbackParam.trim().toLowerCase() !== FEEDBACK_QUEUE_QUERY_VALUE
  ) {
    params.delete('feedback');
  }

  return params.toString();
}

export function stripFeedbackQueueQueryParam(searchString: string): string {
  const params = new URLSearchParams(searchString);
  if (isFeedbackQueueQueryRequested(params)) {
    params.delete('feedback');
  }
  return params.toString();
}

export interface BuildReservationTabHrefOptions {
  reservationId?: string;
  reservationIdParam?: 'reservationId' | 'reservation_id';
  feedbackQueue?: boolean;
}

export function buildReservationTabHref(
  role: ReservationRouteRole,
  tab: ReservationTabParam,
  options?: BuildReservationTabHrefOptions
): string {
  const basePath = getReservationRolePathname(role);
  const params = new URLSearchParams();
  params.set('tab', tab);

  const trimmedId = options?.reservationId?.trim();
  if (trimmedId) {
    const idKey = options?.reservationIdParam ?? 'reservationId';
    params.set(idKey, trimmedId);
  }

  if (options?.feedbackQueue) {
    params.set('feedback', FEEDBACK_QUEUE_QUERY_VALUE);
  }

  return `${basePath}?${params.toString()}`;
}

export function buildReservationHistoryRedirectHref(
  role: ReservationRouteRole,
  rawSearch: string
): string {
  const basePath = getReservationRolePathname(role);
  const incoming = new URLSearchParams(rawSearch);
  const nextParams = new URLSearchParams();
  nextParams.set('tab', 'history');

  incoming.forEach((value, key) => {
    if (key === 'tab') {
      return;
    }
    nextParams.append(key, value);
  });

  return `${basePath}?${nextParams.toString()}`;
}

export function buildReservationHistorySignInCallbackHref(
  rawSearch: string
): string {
  const cleaned = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
  const callbackTarget = cleaned
    ? `${RESERVATION_HISTORY_HREF}?${cleaned}`
    : RESERVATION_HISTORY_HREF;
  return `/auth/signin?callbackUrl=${encodeURIComponent(callbackTarget)}`;
}

function hasRemovableDeepLinkParam(params: URLSearchParams): boolean {
  for (let i = 0; i < FEEDBACK_DEEP_LINK_ID_KEYS.length; i += 1) {
    if (params.has(FEEDBACK_DEEP_LINK_ID_KEYS[i])) {
      return true;
    }
  }
  const feedbackParam = params.get('feedback');
  return (
    feedbackParam !== null &&
    feedbackParam.trim().toLowerCase() !== FEEDBACK_QUEUE_QUERY_VALUE
  );
}

export function buildCleanedDeepLinkHref(
  pathname: string,
  rawSearch: string
): string | null {
  const initialParams = new URLSearchParams(rawSearch);
  if (!hasRemovableDeepLinkParam(initialParams)) {
    return null;
  }
  const cleanedSearch = stripDeepLinkQueryParams(rawSearch);
  const params = new URLSearchParams(cleanedSearch);
  params.set('tab', 'history');
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function buildCleanedFeedbackQueueHref(
  pathname: string,
  rawSearch: string
): string | null {
  const params = new URLSearchParams(rawSearch);
  if (!isFeedbackQueueQueryRequested(params)) {
    return null;
  }
  const nextQuery = stripFeedbackQueueQueryParam(rawSearch);
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function buildReservationTabSwitchHref(
  pathname: string,
  rawSearch: string,
  nextTab?: ReservationTabParam
): string {
  const params = new URLSearchParams(rawSearch);
  params.delete('feedback');
  for (let i = 0; i < FEEDBACK_DEEP_LINK_ID_KEYS.length; i += 1) {
    params.delete(FEEDBACK_DEEP_LINK_ID_KEYS[i]);
  }
  if (nextTab) {
    params.set('tab', nextTab);
  }
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function resolveNotificationCategory(
  type: string
): NotificationSemanticCategory {
  if (type === 'reservation_requested') return 'reservation_requested';
  if (type === 'reservation_success') return 'reservation_success';
  if (type === 'reservation_failed') return 'reservation_failed';
  if (type === 'reservation_canceled') return 'reservation_canceled';
  if (type === 'reservation_upcoming') return 'reservation_upcoming';
  if (type === 'reservation_feedback_requested') return 'feedback_requested';
  if (type === 'reservation_attendance_requested') {
    return 'attendance_requested';
  }
  if (FEEDBACK_REMINDER_TYPES.has(type)) return 'feedback_reminder';
  if (FEEDBACK_RECEIVED_TYPES.has(type)) return 'feedback_received';
  return 'unknown';
}

export function isNotificationMentorContext(input: {
  role?: ReservationRouteRole;
  menteeName?: string;
}): boolean {
  return (
    input.role === 'mentor' ||
    (input.role === undefined && Boolean(input.menteeName))
  );
}

export interface NotificationTargetHrefInput {
  type: string;
  category?: NotificationSemanticCategory;
  role?: ReservationRouteRole;
  menteeName?: string;
  reservationId?: string;
}

export function resolveNotificationTargetHref(
  input: NotificationTargetHrefInput
): string {
  const category = input.category ?? resolveNotificationCategory(input.type);
  const isMentorContext = isNotificationMentorContext(input);

  switch (category) {
    case 'reservation_requested':
      return buildReservationTabHref('mentor', 'pending');
    case 'reservation_success':
      return buildReservationTabHref('mentee', 'upcoming');
    case 'reservation_failed':
      return FIND_MENTOR_HREF;
    case 'reservation_canceled':
      return isMentorContext
        ? buildReservationTabHref('mentor', 'history')
        : FIND_MENTOR_HREF;
    case 'reservation_upcoming':
      return buildReservationTabHref(
        isMentorContext ? 'mentor' : 'mentee',
        'upcoming'
      );
    case 'feedback_requested':
      return buildReservationTabHref(
        input.role === 'mentor' ? 'mentor' : 'mentee',
        'history',
        { reservationId: input.reservationId }
      );
    case 'attendance_requested':
      return buildReservationTabHref(
        input.role === 'mentee' ? 'mentee' : 'mentor',
        'history',
        { reservationId: input.reservationId }
      );
    case 'feedback_reminder':
      return buildReservationTabHref(
        isMentorContext ? 'mentor' : 'mentee',
        'history',
        { reservationId: input.reservationId }
      );
    case 'feedback_received':
      return buildReservationTabHref('mentor', 'history', {
        reservationId: input.reservationId,
      });
    default:
      return HOME_HREF;
  }
}
