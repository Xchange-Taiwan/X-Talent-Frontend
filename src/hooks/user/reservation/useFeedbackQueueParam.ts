'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type FeedbackSessionCoordinator,
  feedbackSessionCoordinator,
} from '@/lib/reservation/feedbackSessionCoordinator';
import {
  buildCleanedFeedbackQueueHref,
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

  const resolvedRole: ReservationRouteRole =
    role ?? (isMentee === false ? 'mentor' : 'mentee');
  const isFeedbackQueueRequested = isFeedbackQueueQueryRequested(searchParams);

  const pendingItems = useMemo(
    () =>
      coordinator.resolveExplicitQueueItems({
        userId,
        role: resolvedRole,
        history,
      }),
    [coordinator, history, resolvedRole, userId]
  );

  const isHistoryReadyForQueueCheck =
    isHistoryLoaded &&
    !isLoadingHistory &&
    !(isLoadingUpcoming && isLoadingPending);

  const [latchedQueue, setLatchedQueue] = useState<Reservation[] | null>(() =>
    isFeedbackQueueRequested && pendingItems.length > 0 ? pendingItems : null
  );
  const [dismissed, setDismissed] = useState(false);

  const clearFeedbackQueueParam = useCallback(() => {
    const nextHref = buildCleanedFeedbackQueueHref(
      pathname,
      searchParams.toString()
    );
    if (!nextHref) return;
    router.replace(nextHref, { scroll: false });
  }, [pathname, router, searchParams]);

  const skipFeedbackQueueItem = useCallback(
    (reservation: Reservation) => {
      if (!reservation?.id) return;
      coordinator.markReservationSkipped(userId?.trim() ?? '', reservation.id);
    },
    [coordinator, userId]
  );

  const dismissFeedbackQueue = useCallback(() => {
    setDismissed(true);
    clearFeedbackQueueParam();
  }, [clearFeedbackQueueParam]);

  useEffect(() => {
    if (!isFeedbackQueueRequested) {
      if (latchedQueue !== null) {
        setLatchedQueue(null);
      }
      if (dismissed) {
        setDismissed(false);
      }
      return;
    }

    if (!dismissed && latchedQueue === null && pendingItems.length > 0) {
      setLatchedQueue(pendingItems);
      return;
    }

    if (
      isHistoryReadyForQueueCheck &&
      pendingItems.length === 0 &&
      latchedQueue === null &&
      !dismissed
    ) {
      clearFeedbackQueueParam();
    }
  }, [
    clearFeedbackQueueParam,
    dismissed,
    isFeedbackQueueRequested,
    isHistoryReadyForQueueCheck,
    latchedQueue,
    pendingItems,
  ]);

  const feedbackQueueItems =
    isFeedbackQueueRequested &&
    !dismissed &&
    latchedQueue &&
    latchedQueue.length > 0
      ? latchedQueue
      : null;

  return {
    isFeedbackQueueRequested,
    feedbackQueueItems,
    skipFeedbackQueueItem,
    dismissFeedbackQueue,
  };
}
