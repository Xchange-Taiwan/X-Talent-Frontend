'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { isFeedbackEnabled } from '@/lib/featureFlags';
import {
  type FeedbackSessionCoordinator,
  feedbackSessionCoordinator,
} from '@/lib/reservation/feedbackSessionCoordinator';
import {
  isFeedbackQueueQueryRequested,
  type ReservationRouteRole,
} from '@/lib/reservation/reservationRoutes';
import type { Reservation } from '@/types/reservation';

export interface UseFeedbackQueueParamOptions {
  role?: ReservationRouteRole;
  isMentee?: boolean;
  userId?: string;
  coordinator?: FeedbackSessionCoordinator;
  history: Reservation[];
  isHistoryLoaded: boolean;
  isLoadingHistory: boolean;
  isLoadingUpcoming: boolean;
  isLoadingPending: boolean;
}

export interface UseFeedbackQueueParamResult {
  isFeedbackQueueRequested: boolean;
  feedbackQueueItems: Reservation[] | null;
  skipFeedbackQueueItem: (reservation: Reservation) => void;
  dismissFeedbackQueue: () => void;
}

export function useFeedbackQueueParam({
  role,
  isMentee,
  userId,
  coordinator = feedbackSessionCoordinator,
  history,
  isHistoryLoaded,
  isLoadingHistory,
  isLoadingUpcoming,
  isLoadingPending,
}: UseFeedbackQueueParamOptions): UseFeedbackQueueParamResult {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const feedbackEnabled = isFeedbackEnabled();
  const resolvedRole: ReservationRouteRole =
    role ?? (isMentee === false ? 'mentor' : 'mentee');
  const rawSearch = searchParams.toString();
  const isFeedbackQueueRequested = feedbackEnabled
    ? isFeedbackQueueQueryRequested(searchParams)
    : false;

  const latestRef = useRef({
    router,
    searchParams,
    pathname,
    userId,
    feedbackEnabled,
  });
  latestRef.current = {
    router,
    searchParams,
    pathname,
    userId,
    feedbackEnabled,
  };

  const routeState = useSyncExternalStore(
    coordinator.subscribe,
    () => coordinator.getHistoryRouteState({ feedbackEnabled }),
    () => coordinator.getHistoryRouteState({ feedbackEnabled: false })
  );

  useEffect(() => {
    return () => {
      coordinator.resetHistoryRouteSession();
    };
  }, [coordinator]);

  useEffect(() => {
    const step = coordinator.reconcileHistoryRoute({
      mode: 'queue',
      role: resolvedRole,
      userId,
      pathname,
      rawSearch,
      searchParams: latestRef.current.searchParams,
      history,
      isHistoryLoaded,
      isLoadingHistory,
      isLoadingUpcoming,
      isLoadingPending,
      feedbackEnabled,
    });

    if (step.commands.replaceHref) {
      latestRef.current.router.replace(step.commands.replaceHref, {
        scroll: false,
      });
    }
  }, [
    coordinator,
    feedbackEnabled,
    history,
    isFeedbackQueueRequested,
    isHistoryLoaded,
    isLoadingHistory,
    isLoadingPending,
    isLoadingUpcoming,
    pathname,
    rawSearch,
    resolvedRole,
    userId,
  ]);

  const skipFeedbackQueueItem = useCallback(
    (reservation: Reservation) => {
      const { feedbackEnabled: enabled, userId: uid } = latestRef.current;
      if (!enabled || !reservation?.id) return;
      coordinator.recordFeedbackOutcome({
        action: 'skip',
        source: 'explicit-queue',
        userId: uid ?? '',
        reservationId: reservation.id,
        feedbackEnabled: enabled,
      });
    },
    [coordinator]
  );

  const dismissFeedbackQueue = useCallback(() => {
    const {
      feedbackEnabled: enabled,
      pathname: currentPath,
      router: currentRouter,
      searchParams: currentParams,
      userId: uid,
    } = latestRef.current;
    if (!enabled) return;

    const { replaceHref } = coordinator.recordFeedbackOutcome({
      action: 'dismiss',
      source: 'explicit-queue',
      userId: uid,
      pathname: currentPath,
      rawSearch: currentParams.toString(),
      feedbackEnabled: enabled,
    });
    if (replaceHref) {
      currentRouter.replace(replaceHref, { scroll: false });
    }
  }, [coordinator]);

  return {
    isFeedbackQueueRequested,
    feedbackQueueItems: isFeedbackQueueRequested
      ? routeState.feedbackQueueItems
      : null,
    skipFeedbackQueueItem,
    dismissFeedbackQueue,
  };
}
