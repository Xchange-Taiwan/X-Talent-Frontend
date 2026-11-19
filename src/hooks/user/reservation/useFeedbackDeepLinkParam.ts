'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { isFeedbackEnabled } from '@/lib/featureFlags';
import {
  type FeedbackSessionCoordinator,
  feedbackSessionCoordinator,
  type FeedbackSessionLookupPort,
  type HistoryRouteCommands,
  type ReconcileHistoryRouteStep,
} from '@/lib/reservation/feedbackSessionCoordinator';
import {
  extractDeepLinkReservationId,
  type ReservationRouteRole,
} from '@/lib/reservation/reservationRoutes';
import type { Reservation } from '@/types/reservation';

export interface UseFeedbackDeepLinkParamOptions {
  userRole: ReservationRouteRole;
  myUserId?: string;
  history: Reservation[];
  isHistoryLoaded: boolean;
  isLoadingHistory: boolean;
  isLoadingMoreHistory?: boolean;
  hasMoreHistory?: boolean;
  onLoadMoreHistory?: () => void;
  coordinator?: FeedbackSessionCoordinator;
  lookupSingleFeedback?: FeedbackSessionLookupPort['fetchSingleReservationFeedback'];
}

export interface UseFeedbackDeepLinkParamResult {
  hasDeepLinkTarget: boolean;
  deepLinkDialogReservation: Reservation | null;
  highlightedReservationId: string | null;
  autoExpandedReservationId: string | null;
  deepLinkTriggerSeq: number;
  dismissDeepLinkDialog: () => void;
  clearDeepLinkFocus: () => void;
}

export function useFeedbackDeepLinkParam({
  userRole,
  myUserId,
  history,
  isHistoryLoaded,
  isLoadingHistory,
  isLoadingMoreHistory = false,
  hasMoreHistory = false,
  onLoadMoreHistory,
  coordinator = feedbackSessionCoordinator,
  lookupSingleFeedback,
}: UseFeedbackDeepLinkParamOptions): UseFeedbackDeepLinkParamResult {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const feedbackEnabled = isFeedbackEnabled();
  const rawSearch = searchParams.toString();
  const targetReservationId = feedbackEnabled
    ? extractDeepLinkReservationId(searchParams)
    : null;
  const canLoadMoreHistory = Boolean(onLoadMoreHistory);

  const latestRef = useRef({
    router,
    toast,
    onLoadMoreHistory,
    lookupSingleFeedback,
    searchParams,
    pathname,
    myUserId,
    feedbackEnabled,
  });
  latestRef.current = {
    router,
    toast,
    onLoadMoreHistory,
    lookupSingleFeedback,
    searchParams,
    pathname,
    myUserId,
    feedbackEnabled,
  };

  const mountAbortRef = useRef<AbortController | null>(null);
  const attachedLookupRef = useRef<Promise<ReconcileHistoryRouteStep> | null>(
    null
  );

  const routeState = useSyncExternalStore(
    coordinator.subscribe,
    () => coordinator.getHistoryRouteState({ feedbackEnabled }),
    () => coordinator.getHistoryRouteState({ feedbackEnabled: false })
  );

  const executeCommands = useCallback((commands: HistoryRouteCommands) => {
    if (commands.toast) {
      latestRef.current.toast({
        title: commands.toast.title,
        description: commands.toast.description,
      });
    }
    if (commands.replaceHref) {
      latestRef.current.router.replace(commands.replaceHref, { scroll: false });
    }
    if (commands.shouldLoadMoreHistory) {
      latestRef.current.onLoadMoreHistory?.();
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    mountAbortRef.current = controller;
    return () => {
      controller.abort();
      mountAbortRef.current = null;
      attachedLookupRef.current = null;
      coordinator.resetHistoryRouteSession();
    };
  }, [coordinator]);

  useEffect(() => {
    const signal = mountAbortRef.current?.signal;
    const step = coordinator.reconcileHistoryRoute({
      mode: 'deep-link',
      role: userRole,
      userId: myUserId,
      pathname,
      rawSearch,
      searchParams: latestRef.current.searchParams,
      history,
      isHistoryLoaded,
      isLoadingHistory,
      isLoadingMoreHistory,
      hasMoreHistory,
      canLoadMoreHistory,
      feedbackEnabled,
      signal,
      lookupSingleFeedback: latestRef.current.lookupSingleFeedback,
    });

    executeCommands(step.commands);

    if (
      step.pendingLookup &&
      attachedLookupRef.current !== step.pendingLookup
    ) {
      const pending = step.pendingLookup;
      attachedLookupRef.current = pending;
      void pending.then((settled) => {
        if (attachedLookupRef.current === pending) {
          attachedLookupRef.current = null;
        }
        if (settled.aborted || signal?.aborted) {
          return;
        }
        executeCommands(settled.commands);
      });
    }
  }, [
    canLoadMoreHistory,
    coordinator,
    executeCommands,
    feedbackEnabled,
    hasMoreHistory,
    history,
    isHistoryLoaded,
    isLoadingHistory,
    isLoadingMoreHistory,
    myUserId,
    pathname,
    rawSearch,
    targetReservationId,
    userRole,
  ]);

  const dismissDeepLinkDialog = useCallback(() => {
    const {
      feedbackEnabled: enabled,
      myUserId: uid,
      pathname: currentPath,
      router: currentRouter,
      searchParams: currentParams,
    } = latestRef.current;
    if (!enabled) return;

    const { replaceHref } = coordinator.recordFeedbackOutcome({
      action: 'close',
      source: 'deep-link',
      userId: uid,
      pathname: currentPath,
      rawSearch: currentParams.toString(),
      feedbackEnabled: enabled,
    });
    if (replaceHref) {
      currentRouter.replace(replaceHref, { scroll: false });
    }
  }, [coordinator]);

  const clearDeepLinkFocus = useCallback(() => {
    coordinator.recordFeedbackOutcome({
      action: 'clear-focus',
      feedbackEnabled: latestRef.current.feedbackEnabled,
    });
  }, [coordinator]);

  return {
    hasDeepLinkTarget: targetReservationId !== null,
    deepLinkDialogReservation: routeState.deepLinkDialogReservation,
    highlightedReservationId: routeState.highlightedReservationId,
    autoExpandedReservationId: routeState.autoExpandedReservationId,
    deepLinkTriggerSeq: routeState.deepLinkTriggerSeq,
    dismissDeepLinkDialog,
    clearDeepLinkFocus,
  };
}
