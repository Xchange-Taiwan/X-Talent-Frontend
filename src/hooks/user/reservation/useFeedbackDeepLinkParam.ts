'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import {
  type FeedbackDeepLinkResolution,
  resolveDeepLinkOutcome,
} from '@/lib/reservation/feedbackDeepLink';
import {
  type FeedbackSessionCoordinator,
  feedbackSessionCoordinator,
} from '@/lib/reservation/feedbackSessionCoordinator';
import {
  buildCleanedDeepLinkHref,
  buildReservationTabHref,
  extractDeepLinkReservationId,
  type ReservationRouteRole,
} from '@/lib/reservation/reservationRoutes';
import {
  fetchSingleReservationFeedback,
  type ReservationFeedbackLookupResult,
} from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

const MAX_DEEP_LINK_LOAD_MORE_PAGES = 3;

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
  lookupSingleFeedback?: (opts: {
    userId: string;
    reservationId: string;
    fallbackRole: ReservationRouteRole;
    signal?: AbortSignal;
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
  coordinator = feedbackSessionCoordinator,
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
  const lookupAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const autoLoadCountRef = useRef(0);
  const lastAutoLoadHistoryLengthRef = useRef(-1);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      lookupAbortRef.current?.abort();
      lookupAbortRef.current = null;
      singleLookupKeyRef.current = null;
    };
  }, []);

  const clearDeepLinkFocus = useCallback(() => {
    setLatchedDialogReservation(null);
    setHighlightedReservationId(null);
    setAutoExpandedReservationId(null);
  }, []);

  const clearDeepLinkParams = useCallback(() => {
    const nextHref = buildCleanedDeepLinkHref(
      pathname,
      searchParams.toString()
    );
    if (!nextHref) return;
    router.replace(nextHref, { scroll: false });
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
      lookupAbortRef.current?.abort();
      lookupAbortRef.current = null;
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
      lookupAbortRef.current?.abort();
      lookupAbortRef.current = null;
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
      lookupAbortRef.current?.abort();
      lookupAbortRef.current = null;
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
      const cleanUserId = myUserId?.trim() ?? '';

      if (cleanUserId) {
        const seeded = coordinator.consumeSeededLookup({
          userId: cleanUserId,
          reservationId: targetReservationId,
        });
        if (seeded.hit) {
          if (!seeded.result) {
            applyNotFoundOutcome(targetKey);
            return;
          }
          if (seeded.result.viewerRole !== userRole) {
            handledKeyRef.current = targetKey;
            coordinator.seedLookupResult({
              userId: cleanUserId,
              reservationId: targetReservationId,
              result: seeded.result,
            });
            router.replace(
              buildReservationTabHref(seeded.result.viewerRole, 'history', {
                reservationId: targetReservationId,
                reservationIdParam: 'reservation_id',
              }),
              { scroll: false }
            );
            return;
          }
          const seededOutcome = resolveDeepLinkOutcome({
            role: userRole,
            targetReservationId,
            history: [seeded.result.reservation],
          });
          if (seededOutcome.kind === 'not-found') {
            applyNotFoundOutcome(targetKey);
            return;
          }
          applyResolvedOutcome(targetKey, seededOutcome);
          return;
        }
      }

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

      if (!cleanUserId) {
        applyNotFoundOutcome(targetKey);
        return;
      }

      if (singleLookupKeyRef.current === targetKey) {
        return;
      }
      singleLookupKeyRef.current = targetKey;
      const controller = new AbortController();
      lookupAbortRef.current = controller;

      void lookupSingleFeedback({
        userId: cleanUserId,
        reservationId: targetReservationId,
        fallbackRole: userRole,
        signal: controller.signal,
      })
        .then((lookupResult) => {
          if (
            !isMountedRef.current ||
            controller.signal.aborted ||
            activeTargetKeyRef.current !== targetKey
          ) {
            return;
          }
          if (!lookupResult) {
            applyNotFoundOutcome(targetKey);
            return;
          }
          if (lookupResult.viewerRole !== userRole) {
            handledKeyRef.current = targetKey;
            coordinator.seedLookupResult({
              userId: cleanUserId,
              reservationId: targetReservationId,
              result: lookupResult,
            });
            router.replace(
              buildReservationTabHref(lookupResult.viewerRole, 'history', {
                reservationId: targetReservationId,
                reservationIdParam: 'reservation_id',
              }),
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
          if (
            !isMountedRef.current ||
            controller.signal.aborted ||
            activeTargetKeyRef.current !== targetKey
          ) {
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
    coordinator,
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
