import { clearUserProfileDtoCache } from '@/hooks/user/user-data/userProfileDtoCache';
import { trackEvent } from '@/lib/analytics';
import { resolveTargetMentorId } from '@/lib/reservation/resolveCounterparty';
import type { Reservation } from '@/types/reservation';
import type {
  FeedbackViewerRole,
  SubmitReservationFeedbackRequest,
} from '@/types/reservationFeedback';

export interface SubmitFeedbackServiceParams {
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: FeedbackViewerRole;
  payload: SubmitReservationFeedbackRequest;
}

export interface SubmitFeedbackWithEffectsParams extends SubmitFeedbackServiceParams {
  submitServiceFn?: (params: SubmitFeedbackServiceParams) => Promise<void>;
}

/**
 * Coordinates reservation feedback submission alongside mentor profile DTO cache
 * invalidation (`zh_TW` / `en_US`) and GA4 analytics tracking so both
 * `useReservationActions` and `usePendingFeedbackQueue` share identical behavior
 * without statically pulling `@/services/reservations` into global root bundles.
 */
export async function submitFeedbackWithEffects({
  reservation,
  myUserId,
  myRole,
  payload,
  submitServiceFn,
}: SubmitFeedbackWithEffectsParams): Promise<void> {
  const submitFn =
    submitServiceFn ??
    (await import('@/services/reservations')).submitReservationFeedback;

  await submitFn({
    reservation,
    myUserId,
    myRole,
    payload,
  });

  if ((payload.meeting_happened || myRole === 'mentor') && myUserId) {
    const targetMentorId = resolveTargetMentorId(reservation, myUserId, myRole);
    if (targetMentorId !== undefined) {
      clearUserProfileDtoCache(targetMentorId, 'zh_TW');
      clearUserProfileDtoCache(targetMentorId, 'en_US');
    }
  }

  trackEvent({
    name: 'reservation_feedback_submitted',
    feature: 'reservation',
    metadata: { meeting_happened: payload.meeting_happened },
  });
}
