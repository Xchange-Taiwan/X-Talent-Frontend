import {
  feedbackSessionCoordinator,
  type SessionPendingFeedbackState,
} from '@/lib/reservation/feedbackSessionCoordinator';

export {
  isAuthResetRoute,
  PENDING_FEEDBACK_SESSION_PREFIX,
  type PendingFeedbackRouteContext,
  type SearchParamReadable,
  type SessionPendingFeedbackState,
  shouldSuppressPendingFeedbackPopup,
  sortPendingFeedbackOldestFirst,
} from '@/lib/reservation/feedbackSessionCoordinator';

export function getSessionPendingFeedbackState(
  userId: string
): SessionPendingFeedbackState {
  return feedbackSessionCoordinator.getSessionState(userId);
}

export function markSessionPendingFeedbackChecked(
  userId: string,
  hasRemainingItems = false
): void {
  feedbackSessionCoordinator.markChecked(userId, hasRemainingItems);
}

export function subscribeSessionReservationSubmitted(
  listener: (userId: string, reservationId: string) => void
): () => void {
  return feedbackSessionCoordinator.subscribeReservationSubmitted(listener);
}

export function markSessionReservationSubmitted(
  userId: string,
  reservationId: string,
  isQueueNowEmpty = false
): void {
  feedbackSessionCoordinator.markReservationSubmitted(
    userId,
    reservationId,
    isQueueNowEmpty
  );
}

export function markSessionReservationSkipped(
  userId: string,
  reservationId: string
): void {
  feedbackSessionCoordinator.markReservationSkipped(userId, reservationId);
}

export function markSessionPendingFeedbackDismissed(
  userId: string,
  remainingReservationIds: readonly string[] = []
): void {
  feedbackSessionCoordinator.markDismissed(userId, remainingReservationIds);
}

export function clearAllSessionPendingFeedbackState(): void {
  feedbackSessionCoordinator.clearAllSessionState();
}
