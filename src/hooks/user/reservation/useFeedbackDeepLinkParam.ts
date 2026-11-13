'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import {
  extractDeepLinkReservationId,
  type FeedbackDeepLinkResolution,
  resolveDeepLinkOutcome,
  stripDeepLinkQueryParams,
} from '@/lib/reservation/feedbackDeepLink';
import {
  fetchSingleReservationFeedback,
  type ReservationFeedbackLookupResult,
} from '@/services/reservations/reservationFeedbackLookup';
import type { Reservation } from '@/types/reservation';

const MAX_DEEP_LINK_LOAD_MORE_PAGES = 3;

export interface UseFeedbackDeepLinkParamOptions {
  userRole: 'mentee' | 'mentor';
  myUserId?: string;
  history: Reservation[];
  isHistoryLoaded: boolean;
  isLoadingHistory: boolean;
  isLoadingMoreHistory?: boolean;
  hasMoreHistory?: boolean;
  onLoadMoreHistory?: () => void;
  lookupSingleFeedback?: (opts: {
    userId: string;
    reservationId: string;
    fallbackRole: 'mentee' | 'mentor';
  }) => Promise<ReservationFeedbackLookupResult | null>;
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
  lookupSingleFeedback = fetchSingleReservationFeedback,
}: UseFeedbackDeepLinkParamOptions): UseFeedbackDeepLinkParamResult {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const targetReservationId = extractDeepLinkReservationId(searchParams);
  const hasDeepLinkTarget = targetReservationId !== null;

  const [latchedDialogReservation, setLatchedDialogReservation] =
    useState<Reservation | null>(null);
  const [highlightedReservationId, setHighlightedReservationId] = useState<
    string | null
  >(null);
  const [autoExpandedReservationId, setAutoExpandedReservationId] = useState<
    string | null
  >(null);
  const [deepLinkTriggerSeq, setDeepLinkTriggerSeq] = useState(0);

  const prevRoleRef = useRef(userRole);
  const activeTargetKeyRef = useRef<string | null>(null);
  const handledKeyRef = useRef<string | null>(null);
  const singleLookupKeyRef = useRef<string | null>(null);
  const autoLoadCountRef = useRef(0);
  const lastAutoLoadHistoryLengthRef = useRef(-1);

  const clearDeepLinkFocus = useCallback(() => {
    setLatchedDialogReservation(null);
    setHighlightedReservationId(null);
    setAutoExpandedReservationId(null);
  }, []);

  const clearDeepLinkParams = useCallback(() => {
    const currentSearch = searchParams.toString();
    const cleanedSearch = stripDeepLinkQueryParams(currentSearch);
    if (cleanedSearch === currentSearch) return;

    const params = new URLSearchParams(cleanedSearch);
    params.set('tab', 'history');
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  const dismissDeepLinkDialog = useCallback(() => {
    setLatchedDialogReservation(null);
    clearDeepLinkParams();
  }, [clearDeepLinkParams]);

  const applyResolvedOutcome = useCallback(
    (
      targetKey: string,
      outcome: Exclude<FeedbackDeepLinkResolution, { kind: 'not-found' }>
    ) => {
      handledKeyRef.current = targetKey;
      setHighlightedReservationId(outcome.reservation.id);
      setDeepLinkTriggerSeq((prev) => prev + 1);

      if (
        outcome.kind === 'mentee-open-dialog' ||
        outcome.kind === 'mentor-open-dialog'
      ) {
        setAutoExpandedReservationId(null);
        setLatchedDialogReservation(outcome.reservation);
        return;
      }

      if (outcome.kind === 'mentee-already-rated') {
        setAutoExpandedReservationId(outcome.reservation.id);
        toast({
          title: '您已填寫過此場會談回饋',
          description: '已為您展開先前的回饋紀錄。',
        });
        clearDeepLinkParams();
        return;
      }

      if (outcome.kind === 'mentee-already-resolved') {
        setAutoExpandedReservationId(null);
        if (outcome.reason === 'cancelled') {
          toast({
            title: '此預約已取消',
            description: '已取消的預約無須填寫會談回饋。',
          });
        } else {
          toast({
            title: '您已完成此場會談紀錄',
            description: '此場會談無須重複填寫回饋。',
          });
        }
        clearDeepLinkParams();
        return;
      }

      setAutoExpandedReservationId(
        outcome.shouldExpandFeedback ? outcome.reservation.id : null
      );
      clearDeepLinkParams();
    },
    [clearDeepLinkParams, toast]
  );

  const applyNotFoundOutcome = useCallback(
    (targetKey: string) => {
      handledKeyRef.current = targetKey;
      setHighlightedReservationId(null);
      setAutoExpandedReservationId(null);
      toast({
        title: '找不到指定的會談紀錄',
        description: '請確認您登入的帳號是否正確，或於歷史紀錄列表查看。',
      });
      clearDeepLinkParams();
    },
    [clearDeepLinkParams, toast]
  );

  useEffect(() => {
    if (prevRoleRef.current !== userRole) {
      prevRoleRef.current = userRole;
      activeTargetKeyRef.current = null;
      handledKeyRef.current = null;
      singleLookupKeyRef.current = null;
      autoLoadCountRef.current = 0;
      lastAutoLoadHistoryLengthRef.current = -1;
      setLatchedDialogReservation(null);
      setHighlightedReservationId(null);
      setAutoExpandedReservationId(null);
    }

    if (!targetReservationId) {
      activeTargetKeyRef.current = null;
      handledKeyRef.current = null;
      singleLookupKeyRef.current = null;
      autoLoadCountRef.current = 0;
      lastAutoLoadHistoryLengthRef.current = -1;
      if (latchedDialogReservation !== null) {
        setLatchedDialogReservation(null);
      }
      return;
    }

    const targetKey = `${userRole}:${targetReservationId}`;
    if (activeTargetKeyRef.current !== targetKey) {
      activeTargetKeyRef.current = targetKey;
      singleLookupKeyRef.current = null;
      autoLoadCountRef.current = 0;
      lastAutoLoadHistoryLengthRef.current = -1;
      if (latchedDialogReservation !== null) {
        setLatchedDialogReservation(null);
      }
    }

    if (handledKeyRef.current === targetKey) {
      return;
    }

    if (!isHistoryLoaded || isLoadingHistory || isLoadingMoreHistory) {
      return;
    }

    const outcome = resolveDeepLinkOutcome({
      role: userRole,
      targetReservationId,
      history,
    });

    if (outcome.kind === 'not-found') {
      const canTryNextPage =
        hasMoreHistory &&
        Boolean(onLoadMoreHistory) &&
        autoLoadCountRef.current < MAX_DEEP_LINK_LOAD_MORE_PAGES &&
        lastAutoLoadHistoryLengthRef.current !== history.length;

      if (canTryNextPage) {
        autoLoadCountRef.current += 1;
        lastAutoLoadHistoryLengthRef.current = history.length;
        onLoadMoreHistory?.();
        return;
      }

      const cleanUserId = myUserId?.trim() ?? '';
      if (!cleanUserId) {
        applyNotFoundOutcome(targetKey);
        return;
      }

      if (singleLookupKeyRef.current === targetKey) {
        return;
      }
      singleLookupKeyRef.current = targetKey;

      void lookupSingleFeedback({
        userId: cleanUserId,
        reservationId: targetReservationId,
        fallbackRole: userRole,
      })
        .then((lookupResult) => {
          if (activeTargetKeyRef.current !== targetKey) {
            return;
          }
          if (!lookupResult) {
            applyNotFoundOutcome(targetKey);
            return;
          }
          if (lookupResult.viewerRole !== userRole) {
            handledKeyRef.current = targetKey;
            router.replace(
              `/reservation/${lookupResult.viewerRole}?tab=history&reservation_id=${encodeURIComponent(targetReservationId)}`,
              { scroll: false }
            );
            return;
          }
          const singleOutcome = resolveDeepLinkOutcome({
            role: userRole,
            targetReservationId,
            history: [lookupResult.reservation],
          });
          if (singleOutcome.kind === 'not-found') {
            applyNotFoundOutcome(targetKey);
            return;
          }
          applyResolvedOutcome(targetKey, singleOutcome);
        })
        .catch(() => {
          if (activeTargetKeyRef.current !== targetKey) {
            return;
          }
          applyNotFoundOutcome(targetKey);
        });
      return;
    }

    applyResolvedOutcome(targetKey, outcome);
  }, [
    applyNotFoundOutcome,
    applyResolvedOutcome,
    hasMoreHistory,
    history,
    isHistoryLoaded,
    isLoadingHistory,
    isLoadingMoreHistory,
    latchedDialogReservation,
    lookupSingleFeedback,
    myUserId,
    onLoadMoreHistory,
    router,
    targetReservationId,
    userRole,
  ]);

  return {
    hasDeepLinkTarget,
    deepLinkDialogReservation: latchedDialogReservation,
    highlightedReservationId,
    autoExpandedReservationId,
    deepLinkTriggerSeq,
    dismissDeepLinkDialog,
    clearDeepLinkFocus,
  };
}
