'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { trackEvent } from '@/lib/analytics';
import { isFeedbackEnabled } from '@/lib/featureFlags';
import {
  type FeedbackSessionCoordinator,
  feedbackSessionCoordinator,
  isAuthResetRoute,
  shouldSuppressPendingFeedbackPopup,
} from '@/lib/reservation/feedbackSessionCoordinator';
import { resolveFeedbackViewerRole } from '@/lib/reservation/resolveCounterparty';
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
  const shownUserIdRef = useRef<string | null>(null);
  const dismissedUserIdRef = useRef<string | null>(null);
  const presentedIdsRef = useRef<Set<string>>(new Set());
  const submittedIdsRef = useRef<Set<string>>(new Set());
  const skippedIdsRef = useRef<Set<string>>(new Set());

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
    if (status === 'loading' && !isAuthResetRoute(pathname)) {
      return;
    }
    const isReset = status === 'unauthenticated' || isAuthResetRoute(pathname);
    if (isReset) {
      shownUserIdRef.current = null;
      dismissedUserIdRef.current = null;
      presentedIdsRef.current.clear();
      submittedIdsRef.current.clear();
      skippedIdsRef.current.clear();
    }
    coordinator.syncAuthSession({
      isResetRouteOrUnauthenticated: isReset,
      userId: status === 'authenticated' ? rawUserId : '',
    });
  }, [coordinator, feedbackEnabled, pathname, rawUserId, status]);

  useEffect(() => {
    if (!feedbackEnabled || !rawUserId || status !== 'authenticated') {
      return;
    }
    coordinator.syncLoginQueuePresentation({
      userId: rawUserId,
      canPresent: canPresentQueue,
    });
  }, [canPresentQueue, coordinator, feedbackEnabled, rawUserId, status]);

  useEffect(() => {
    if (!feedbackEnabled || !canPresentQueue || !rawUserId) {
      return;
    }

    if (!coordinator.shouldFetchLoginQueue(rawUserId)) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      const { fetchPendingFeedbackReservations } =
        await import('@/services/reservations');
      if (controller.signal.aborted) {
        return;
      }
      await coordinator.loadLoginQueue({
        userId: rawUserId,
        isMentor: isMentorSession,
        signal: controller.signal,
        fetchPending: fetchPendingFeedbackReservations,
      });
    })();

    return () => {
      controller.abort();
    };
  }, [
    canPresentQueue,
    coordinator,
    feedbackEnabled,
    isMentorSession,
    rawUserId,
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

  useEffect(() => {
    if (
      !feedbackEnabled ||
      !rawUserId ||
      !queueItems ||
      queueItems.length === 0
    ) {
      return;
    }
    for (const item of queueItems) {
      presentedIdsRef.current.add(item.id);
    }
    if (shownUserIdRef.current !== rawUserId) {
      shownUserIdRef.current = rawUserId;
      dismissedUserIdRef.current = null;
      trackEvent({
        name: 'feedback_prompt_shown',
        feature: 'feedback',
        metadata: { pending_count: queueItems.length },
      });
    }
  }, [feedbackEnabled, queueItems, rawUserId]);

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

      submittedIdsRef.current.add(targetReservation.id);

      trackEvent({
        name: 'reservation_feedback_submitted',
        feature: 'reservation',
        metadata: { meeting_happened: payload.meeting_happened },
      });
    },
    [rawUserId, isRoleResolved, isMentorSession]
  );

  const skipFeedbackItem = useCallback(
    (reservation: Reservation) => {
      if (!rawUserId) return;
      skippedIdsRef.current.add(reservation.id);
      coordinator.markReservationSkipped(rawUserId, reservation.id);
    },
    [coordinator, rawUserId]
  );

  const dismissQueue = useCallback(() => {
    if (rawUserId && dismissedUserIdRef.current !== rawUserId) {
      const unsubmittedCount = Array.from(presentedIdsRef.current).filter(
        (id) => !submittedIdsRef.current.has(id)
      ).length;
      const skippedCount = Math.max(
        skippedIdsRef.current.size,
        unsubmittedCount
      );
      if (skippedCount > 0) {
        dismissedUserIdRef.current = rawUserId;
        trackEvent({
          name: 'feedback_prompt_dismissed',
          feature: 'feedback',
          metadata: { skipped_count: skippedCount },
        });
      }
    }
    coordinator.dismissLoginQueue(rawUserId);
  }, [coordinator, rawUserId]);

  return {
    queueItems,
    submitFeedbackItem,
    skipFeedbackItem,
    dismissQueue,
  };
}
