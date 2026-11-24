'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { trackEvent } from '@/lib/analytics';
import { isFeedbackEnabled } from '@/lib/featureFlags';
import {
  type FeedbackSessionCoordinator,
  feedbackSessionCoordinator,
  shouldSuppressPendingFeedbackPopup,
} from '@/lib/reservation/feedbackSessionCoordinator';
import { resolveFeedbackViewerRole } from '@/lib/reservation/reservationProjection';
import type { Reservation } from '@/types/reservation';
import type { SubmitReservationFeedbackRequest } from '@/types/reservationFeedback';

export interface UsePendingFeedbackQueueResult {
  queueItems: Reservation[] | null;
  submitFeedbackItem: (
    payload: SubmitReservationFeedbackRequest,
    targetReservation: Reservation
  ) => Promise<void>;
  skipFeedbackItem: (reservation: Reservation) => void;
  dismissQueue: () => void;
}

export function usePendingFeedbackQueue(
  coordinator: FeedbackSessionCoordinator = feedbackSessionCoordinator
): UsePendingFeedbackQueueResult {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawUserId = session?.user?.id ? String(session.user.id) : '';
  const rawIsMentor = session?.user?.isMentor;
  const isRoleResolved = typeof rawIsMentor === 'boolean';
  const isMentorSession = rawIsMentor === true;
  const isOnboardingComplete = session?.user?.onBoarding === true;
  const hasSessionError = Boolean(session?.error);

  const feedbackEnabled = isFeedbackEnabled();
  const rawSearch = searchParams.toString();

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const isSuppressed = shouldSuppressPendingFeedbackPopup({
    pathname,
    searchParams,
  });

  const canPresentQueue =
    feedbackEnabled &&
    status === 'authenticated' &&
    Boolean(rawUserId) &&
    isOnboardingComplete &&
    isRoleResolved &&
    !hasSessionError &&
    !isSuppressed;

  useEffect(() => {
    if (!feedbackEnabled) {
      return;
    }
    return () => {
      coordinator.resetRuntimeLoginSession();
    };
  }, [coordinator, feedbackEnabled]);

  useEffect(() => {
    if (!feedbackEnabled) {
      return;
    }

    const controller = new AbortController();

    void coordinator
      .reconcileLoginSession({
        authStatus: status,
        userId: rawUserId,
        isMentor: rawIsMentor,
        isOnboardingComplete,
        hasSessionError,
        route: {
          pathname,
          searchParams: searchParamsRef.current,
        },
        feedbackEnabled,
        signal: controller.signal,
      })
      .then((reconciled) => {
        if (
          !controller.signal.aborted &&
          reconciled.promptShownCount !== null &&
          reconciled.promptShownCount > 0
        ) {
          trackEvent({
            name: 'feedback_prompt_shown',
            feature: 'feedback',
            metadata: { pending_count: reconciled.promptShownCount },
          });
        }
      });

    return () => {
      controller.abort();
    };
  }, [
    coordinator,
    feedbackEnabled,
    hasSessionError,
    isOnboardingComplete,
    isSuppressed,
    pathname,
    rawIsMentor,
    rawSearch,
    rawUserId,
    status,
  ]);

  const queueItems = useSyncExternalStore(
    coordinator.subscribe,
    () =>
      feedbackEnabled
        ? coordinator.getPresentedLoginQueue({
            userId: rawUserId,
            canPresent: canPresentQueue,
          })
        : null,
    () => null
  );

  const submitFeedbackItem = useCallback(
    async (
      payload: SubmitReservationFeedbackRequest,
      targetReservation: Reservation
    ) => {
      if (!rawUserId) {
        throw new Error('[usePendingFeedbackQueue] missing current user id');
      }

      const hasExplicitViewerRole =
        targetReservation.viewerRole === 'MENTOR' ||
        targetReservation.viewerRole === 'MENTEE';
      if (!hasExplicitViewerRole && !isRoleResolved) {
        throw new Error('[usePendingFeedbackQueue] unresolved user role');
      }

      const roleForReservation = resolveFeedbackViewerRole(
        targetReservation.viewerRole,
        isMentorSession
      );

      const { submitReservationFeedback } =
        await import('@/services/reservations');
      await submitReservationFeedback({
        reservation: targetReservation,
        myUserId: rawUserId,
        myRole: roleForReservation,
        payload,
      });

      coordinator.recordFeedbackOutcome({
        action: 'submit',
        source: 'login-queue',
        userId: rawUserId,
        reservationId: targetReservation.id,
        feedbackEnabled,
      });

      trackEvent({
        name: 'reservation_feedback_submitted',
        feature: 'reservation',
        metadata: { meeting_happened: payload.meeting_happened },
      });
    },
    [coordinator, feedbackEnabled, isMentorSession, isRoleResolved, rawUserId]
  );

  const skipFeedbackItem = useCallback(
    (reservation: Reservation) => {
      if (!rawUserId || !reservation?.id) return;
      coordinator.recordFeedbackOutcome({
        action: 'skip',
        source: 'login-queue',
        userId: rawUserId,
        reservationId: reservation.id,
        feedbackEnabled,
      });
    },
    [coordinator, feedbackEnabled, rawUserId]
  );

  const dismissQueue = useCallback(() => {
    const outcome = coordinator.recordFeedbackOutcome({
      action: 'dismiss',
      source: 'login-queue',
      userId: rawUserId,
      feedbackEnabled,
    });
    if (outcome.dismissedSkippedCount > 0) {
      trackEvent({
        name: 'feedback_prompt_dismissed',
        feature: 'feedback',
        metadata: { skipped_count: outcome.dismissedSkippedCount },
      });
    }
  }, [coordinator, feedbackEnabled, rawUserId]);

  return {
    queueItems,
    submitFeedbackItem,
    skipFeedbackItem,
    dismissQueue,
  };
}
