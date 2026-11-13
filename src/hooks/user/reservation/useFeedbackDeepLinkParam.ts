'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { subscribeFeedbackDeepLink } from '@/lib/reservation/feedbackDeepLink';
import type { Reservation } from '@/types/reservation';

const MAX_DEEP_LINK_AUTO_PAGES = 10;

export interface UseFeedbackDeepLinkParamOptions {
  hasExplicitNonHistoryTab: boolean;
  history: Reservation[];
  isHistoryLoaded: boolean;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  isLoadingMoreHistory: boolean;
  nextHistoryCursor: number;
  onLoadMoreHistory: () => void;
}

export interface UseFeedbackDeepLinkParamResult {
  highlightedReservationId: string | undefined;
  highlightNonce: number;
  shouldForceHistoryTab: boolean;
}

export function useFeedbackDeepLinkParam({
  hasExplicitNonHistoryTab,
  history,
  isHistoryLoaded,
  isLoadingHistory,
  hasMoreHistory,
  isLoadingMoreHistory,
  nextHistoryCursor,
  onLoadMoreHistory,
}: UseFeedbackDeepLinkParamOptions): UseFeedbackDeepLinkParamResult {
  const searchParams = useSearchParams();
  const rawReservationId = searchParams.get('reservationId')?.trim() ?? '';
  const urlReservationId =
    rawReservationId.length > 0 ? rawReservationId : undefined;

  const [retriggerState, setRetriggerState] = useState<{
    id: string | undefined;
    nonce: number;
  }>({ id: undefined, nonce: 0 });

  const autoLoadTrackerRef = useRef<{
    id: string;
    nonce: number;
    lastCursor: number;
    pagesLoaded: number;
  } | null>(null);

  useEffect(() => {
    return subscribeFeedbackDeepLink((targetReservationId) => {
      autoLoadTrackerRef.current = null;
      setRetriggerState((prev) => ({
        id: targetReservationId,
        nonce: prev.nonce + 1,
      }));
    });
  }, []);

  const highlightedReservationId = urlReservationId;
  const isRetriggerForCurrentId =
    highlightedReservationId !== undefined &&
    retriggerState.id === highlightedReservationId &&
    retriggerState.nonce > 0;
  const highlightNonce = isRetriggerForCurrentId ? retriggerState.nonce : 0;

  const shouldForceHistoryTab =
    highlightedReservationId !== undefined &&
    (!hasExplicitNonHistoryTab || isRetriggerForCurrentId);

  useEffect(() => {
    if (!highlightedReservationId || !shouldForceHistoryTab) {
      autoLoadTrackerRef.current = null;
      return;
    }

    if (!isHistoryLoaded || isLoadingHistory || isLoadingMoreHistory) {
      return;
    }

    const isTargetLoaded = history.some(
      (item) => String(item.id) === highlightedReservationId
    );
    if (isTargetLoaded || !hasMoreHistory || nextHistoryCursor === 0) {
      return;
    }

    const tracker = autoLoadTrackerRef.current;
    if (
      tracker &&
      tracker.id === highlightedReservationId &&
      tracker.nonce === highlightNonce
    ) {
      if (
        tracker.lastCursor === nextHistoryCursor ||
        tracker.pagesLoaded >= MAX_DEEP_LINK_AUTO_PAGES
      ) {
        return;
      }
      autoLoadTrackerRef.current = {
        id: highlightedReservationId,
        nonce: highlightNonce,
        lastCursor: nextHistoryCursor,
        pagesLoaded: tracker.pagesLoaded + 1,
      };
    } else {
      autoLoadTrackerRef.current = {
        id: highlightedReservationId,
        nonce: highlightNonce,
        lastCursor: nextHistoryCursor,
        pagesLoaded: 1,
      };
    }

    onLoadMoreHistory();
  }, [
    hasMoreHistory,
    highlightNonce,
    highlightedReservationId,
    history,
    isHistoryLoaded,
    isLoadingHistory,
    isLoadingMoreHistory,
    nextHistoryCursor,
    onLoadMoreHistory,
    shouldForceHistoryTab,
  ]);

  return {
    highlightedReservationId,
    highlightNonce,
    shouldForceHistoryTab,
  };
}
