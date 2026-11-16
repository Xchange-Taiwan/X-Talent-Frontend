import {
  canEditReservationFeedback,
  canSubmitReservationFeedback,
  hasExpandableMentorFeedback,
  isMenteeSessionMarkedNotHappened,
  isReservationCancelled,
} from '@/lib/reservation/reservationLifecyclePolicy';
import type { Reservation } from '@/types/reservation';

export {
  extractDeepLinkReservationId,
  FEEDBACK_DEEP_LINK_ID_KEYS,
  stripDeepLinkQueryParams,
} from '@/lib/reservation/reservationRoutes';

export type FeedbackDeepLinkResolution =
  | { kind: 'not-found' }
  | { kind: 'mentee-open-dialog'; reservation: Reservation }
  | { kind: 'mentor-open-dialog'; reservation: Reservation }
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
    if (canSubmitReservationFeedback(target, 'mentor')) {
      return {
        kind: 'mentor-open-dialog',
        reservation: target,
      };
    }

    return {
      kind: 'mentor-locate-card',
      reservation: target,
      shouldExpandFeedback: hasExpandableMentorFeedback(target),
    };
  }

  if (isReservationCancelled(target)) {
    return {
      kind: 'mentee-already-resolved',
      reservation: target,
      reason: 'cancelled',
    };
  }

  if (canSubmitReservationFeedback(target, 'mentee')) {
    return {
      kind: 'mentee-open-dialog',
      reservation: target,
    };
  }

  if (canEditReservationFeedback(target, 'mentee')) {
    return {
      kind: 'mentee-already-rated',
      reservation: target,
    };
  }

  if (isMenteeSessionMarkedNotHappened(target)) {
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
