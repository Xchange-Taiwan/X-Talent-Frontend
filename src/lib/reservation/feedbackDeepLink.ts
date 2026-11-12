import type { Reservation } from '@/types/reservation';

export const FEEDBACK_DEEP_LINK_ID_KEYS = [
  'reservationId',
  'reservation_id',
  'feedbackReservationId',
] as const;

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

function normalizeCandidateId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (RESERVED_NON_ID_VALUES.has(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

/**
 * Extracts a target reservation ID from URL query parameters for post-meeting
 * reminder email & in-app notification deep links (#733).
 */
export function extractDeepLinkReservationId(
  searchParams: Pick<URLSearchParams, 'get'>
): string | null {
  for (const key of FEEDBACK_DEEP_LINK_ID_KEYS) {
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

/**
 * Removes single-use feedback deep-link query parameters while preserving
 * `tab` (and `feedback=queue` when unrelated to a single-session deep link).
 */
export function stripDeepLinkQueryParams(searchString: string): string {
  const params = new URLSearchParams(searchString);
  for (const key of FEEDBACK_DEEP_LINK_ID_KEYS) {
    params.delete(key);
  }

  const feedbackParam = params.get('feedback');
  if (
    feedbackParam !== null &&
    feedbackParam.trim().toLowerCase() !== 'queue'
  ) {
    params.delete('feedback');
  }

  return params.toString();
}

export type FeedbackDeepLinkResolution =
  | { kind: 'not-found' }
  | { kind: 'mentee-open-dialog'; reservation: Reservation }
  | { kind: 'mentee-already-rated'; reservation: Reservation }
  | {
      kind: 'mentee-already-resolved';
      reservation: Reservation;
      reason: 'cancelled' | 'not-happened' | 'completed';
    }
  | {
      kind: 'mentor-locate-card';
      reservation: Reservation;
      shouldExpandFeedback: boolean;
    };

export function resolveDeepLinkOutcome(opts: {
  role: 'mentee' | 'mentor';
  targetReservationId: string;
  history: readonly Reservation[];
}): FeedbackDeepLinkResolution {
  const { role, targetReservationId, history } = opts;
  const target = history.find((item) => item.id === targetReservationId);

  if (!target) {
    return { kind: 'not-found' };
  }

  if (role === 'mentor') {
    const shouldExpandFeedback = Boolean(
      !target.cancelledBy &&
      target.feedback?.meetingHappened !== false &&
      target.feedback?.rating &&
      target.feedback.rating.isPublic !== false
    );
    return {
      kind: 'mentor-locate-card',
      reservation: target,
      shouldExpandFeedback,
    };
  }

  if (target.cancelledBy) {
    return {
      kind: 'mentee-already-resolved',
      reservation: target,
      reason: 'cancelled',
    };
  }

  if (
    target.feedback?.nextStep === 'ANSWER' ||
    target.feedback?.nextStep === 'RATE'
  ) {
    return {
      kind: 'mentee-open-dialog',
      reservation: target,
    };
  }

  if (target.feedback?.rating) {
    return {
      kind: 'mentee-already-rated',
      reservation: target,
    };
  }

  if (target.feedback?.meetingHappened === false) {
    return {
      kind: 'mentee-already-resolved',
      reservation: target,
      reason: 'not-happened',
    };
  }

  return {
    kind: 'mentee-already-resolved',
    reservation: target,
    reason: 'completed',
  };
}
