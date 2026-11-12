'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { filterPendingFeedbackQueueItems } from '@/lib/reservation/resolveHistoryFeedbackState';
import type { Reservation } from '@/types/reservation';

export interface UseFeedbackQueueParamOptions {
  isMentee: boolean;
  history: Reservation[];
  isHistoryLoaded: boolean;
  isLoadingHistory: boolean;
  isLoadingUpcoming: boolean;
  isLoadingPending: boolean;
}

export interface UseFeedbackQueueParamResult {
  isFeedbackQueueRequested: boolean;
  feedbackQueueItems: Reservation[] | null;
  dismissFeedbackQueue: () => void;
}

export function useFeedbackQueueParam({
  isMentee,
  history,
  isHistoryLoaded,
  isLoadingHistory,
  isLoadingUpcoming,
  isLoadingPending,
}: UseFeedbackQueueParamOptions): UseFeedbackQueueParamResult {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const hasFeedbackQueueParam = searchParams.get('feedback') === 'queue';
  const isFeedbackQueueRequested = isMentee && hasFeedbackQueueParam;

  const pendingItems = useMemo(
    () => filterPendingFeedbackQueueItems(history),
    [history]
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
    if (searchParams.get('feedback') === null) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('feedback');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  const dismissFeedbackQueue = useCallback(() => {
    setDismissed(true);
    clearFeedbackQueueParam();
  }, [clearFeedbackQueueParam]);

  useEffect(() => {
    if (!hasFeedbackQueueParam) {
      if (latchedQueue !== null) {
        setLatchedQueue(null);
      }
      if (dismissed) {
        setDismissed(false);
      }
      return;
    }

    if (!isMentee) {
      if (latchedQueue !== null) {
        setLatchedQueue(null);
      }
      if (dismissed) {
        setDismissed(false);
      }
      clearFeedbackQueueParam();
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
    hasFeedbackQueueParam,
    isHistoryReadyForQueueCheck,
    isMentee,
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
    dismissFeedbackQueue,
  };
}
