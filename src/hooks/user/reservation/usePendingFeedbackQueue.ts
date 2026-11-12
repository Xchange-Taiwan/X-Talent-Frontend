'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  clearAllSessionPendingFeedbackState,
  getSessionPendingFeedbackState,
  isAuthResetRoute,
  markSessionPendingFeedbackChecked,
  markSessionPendingFeedbackDismissed,
  markSessionReservationSkipped,
  shouldSuppressPendingFeedbackPopup,
  subscribeSessionReservationSubmitted,
} from '@/lib/reservation/pendingFeedbackGuard';
import {
  normalizeReservationViewerRole,
  resolveFeedbackViewerRole,
} from '@/lib/reservation/resolveCounterparty';
import type { Reservation } from '@/types/reservation';
import type { SubmitReservationFeedbackRequest } from '@/types/reservationFeedback';

import { submitFeedbackWithEffects } from './submitFeedbackWithEffects';

export interface UsePendingFeedbackQueueResult {
  queueItems: Reservation[] | null;
  submitFeedbackItem: (
    payload: SubmitReservationFeedbackRequest,
    targetReservation: Reservation
  ) => Promise<void>;
  skipFeedbackItem: (reservation: Reservation) => void;
  dismissQueue: () => void;
}

export function usePendingFeedbackQueue(): UsePendingFeedbackQueueResult {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [queueItems, setQueueItems] = useState<Reservation[] | null>(null);
  const activeQueueIdsRef = useRef<string[]>([]);
  const submittedIdsRef = useRef<Set<string>>(new Set());
  const prevUserIdRef = useRef<string | null>(null);
  const fetchedUserInRuntimeRef = useRef<string | null>(null);

  const rawUserId = session?.user?.id ? String(session.user.id) : '';
  const rawIsMentor = session?.user?.isMentor;
  const isRoleResolved = typeof rawIsMentor === 'boolean';
  const isMentorSession = rawIsMentor === true;
  const isOnboardingComplete = session?.user?.onBoarding === true;
  const hasSessionError = Boolean(session?.error);

  const isSuppressed = shouldSuppressPendingFeedbackPopup({
    pathname,
    searchParams,
  });

  const canPresentQueue =
    status === 'authenticated' &&
    Boolean(rawUserId) &&
    isOnboardingComplete &&
    isRoleResolved &&
    !hasSessionError &&
    !isSuppressed;

  const canPresentQueueRef = useRef(canPresentQueue);
  canPresentQueueRef.current = canPresentQueue;

  const syncStorageAfterPrune = useCallback((userId: string) => {
    if (activeQueueIdsRef.current.length > 0) {
      return;
    }
    const persisted = getSessionPendingFeedbackState(userId);
    if (persisted.skippedIds.length > 0) {
      markSessionPendingFeedbackDismissed(userId, []);
    } else if (
      persisted.checked ||
      persisted.submittedIds.length > 0 ||
      submittedIdsRef.current.size > 0
    ) {
      markSessionPendingFeedbackChecked(userId, false);
    }
  }, []);

  const pruneCompletedAndSkippedItems = useCallback(
    (userId: string, shouldUpdateQueueState: boolean) => {
      const persisted = getSessionPendingFeedbackState(userId);
      const excludedIds = new Set([
        ...persisted.skippedIds,
        ...persisted.submittedIds,
        ...Array.from(submittedIdsRef.current),
      ]);
      const hadActiveItems = activeQueueIdsRef.current.length > 0;
      activeQueueIdsRef.current = activeQueueIdsRef.current.filter(
        (id) => !excludedIds.has(id)
      );
      if (hadActiveItems && activeQueueIdsRef.current.length === 0) {
        syncStorageAfterPrune(userId);
      }

      if (!shouldUpdateQueueState) {
        return;
      }

      setQueueItems((prev) => {
        if (!prev || prev.length === 0) {
          return prev;
        }
        const remaining = prev.filter((item) => !excludedIds.has(item.id));
        if (remaining.length === prev.length) {
          return prev;
        }
        return remaining.length > 0 ? remaining : null;
      });
    },
    [syncStorageAfterPrune]
  );

  // Keep persistent queue tracking synchronized whenever feedback is submitted
  // from any UI surface. While the modal is actively presented (`canPresentQueueRef.current`),
  // avoid shrinking `queueItems` React state mid-flow so `MeetingFeedbackDialog`
  // keeps a stable queue array without double-offsetting `queueIndex` or unmounting
  // prematurely before `onFinishQueue` / `onClose` (`dismissQueue`).
  useEffect(() => {
    if (!rawUserId) {
      return;
    }

    return subscribeSessionReservationSubmitted(
      (submittedUserId, reservationId) => {
        if (submittedUserId !== rawUserId) {
          return;
        }
        submittedIdsRef.current.add(reservationId);
        pruneCompletedAndSkippedItems(rawUserId, !canPresentQueueRef.current);
      }
    );
  }, [rawUserId, pruneCompletedAndSkippedItems]);

  // Whenever the queue is hidden/yielding (`!canPresentQueue`, e.g. navigating to
  // `/reservation/*`), prune any items already submitted or skipped while the modal
  // was open so returning to an eligible route only surfaces remaining items.
  useEffect(() => {
    if (canPresentQueue || !rawUserId) {
      return;
    }

    pruneCompletedAndSkippedItems(rawUserId, true);
  }, [canPresentQueue, rawUserId, pruneCompletedAndSkippedItems]);

  // Clear per-login skip state whenever user logs out, switches account, or enters /auth/* sign-in flow.
  useEffect(() => {
    if (status === 'unauthenticated' || isAuthResetRoute(pathname)) {
      clearAllSessionPendingFeedbackState();
      prevUserIdRef.current = null;
      fetchedUserInRuntimeRef.current = null;
      submittedIdsRef.current.clear();
      activeQueueIdsRef.current = [];
      setQueueItems(null);
      return;
    }

    if (
      status === 'authenticated' &&
      rawUserId &&
      prevUserIdRef.current !== null &&
      prevUserIdRef.current !== rawUserId
    ) {
      clearAllSessionPendingFeedbackState();
      fetchedUserInRuntimeRef.current = null;
      submittedIdsRef.current.clear();
      activeQueueIdsRef.current = [];
      setQueueItems(null);
    }

    if (status === 'authenticated' && rawUserId) {
      prevUserIdRef.current = rawUserId;
    }
  }, [status, pathname, rawUserId]);

  useEffect(() => {
    if (
      status !== 'authenticated' ||
      !rawUserId ||
      !isOnboardingComplete ||
      !isRoleResolved ||
      hasSessionError ||
      isSuppressed
    ) {
      return;
    }

    const sessionState = getSessionPendingFeedbackState(rawUserId);
    if (sessionState.dismissed) {
      return;
    }

    // Skip re-fetching during SPA navigations within the same JS runtime,
    // or across page reloads when the queue was already confirmed empty.
    // If the user reloads mid-queue (`checked && !queueEmpty && !dismissed`),
    // re-fetch so remaining unanswered meetings are never lost.
    if (
      fetchedUserInRuntimeRef.current === rawUserId ||
      (sessionState.checked && sessionState.queueEmpty)
    ) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const { fetchPendingFeedbackReservations } =
          await import('@/services/reservations');
        if (cancelled || controller.signal.aborted) {
          return;
        }

        const items = await fetchPendingFeedbackReservations({
          userId: rawUserId,
          fallbackViewerRole: isMentorSession ? 'MENTOR' : 'MENTEE',
          signal: controller.signal,
        });

        if (cancelled || controller.signal.aborted) {
          return;
        }

        const persisted = getSessionPendingFeedbackState(rawUserId);
        const excludedIds = new Set([
          ...persisted.skippedIds,
          ...persisted.submittedIds,
          ...Array.from(submittedIdsRef.current),
        ]);
        const remaining = items
          .filter((item) => !excludedIds.has(item.id))
          .map((item) => normalizeReservationViewerRole(item, isMentorSession));

        fetchedUserInRuntimeRef.current = rawUserId;
        markSessionPendingFeedbackChecked(rawUserId, remaining.length > 0);

        if (remaining.length > 0) {
          activeQueueIdsRef.current = remaining.map((item) => item.id);
          setQueueItems(remaining);
        } else {
          activeQueueIdsRef.current = [];
          setQueueItems(null);
        }
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          fetchedUserInRuntimeRef.current = rawUserId;
          activeQueueIdsRef.current = [];
          setQueueItems(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    status,
    rawUserId,
    isRoleResolved,
    isMentorSession,
    isOnboardingComplete,
    hasSessionError,
    isSuppressed,
  ]);

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

      await submitFeedbackWithEffects({
        reservation: targetReservation,
        myUserId: rawUserId,
        myRole: roleForReservation,
        payload,
      });
    },
    [rawUserId, isRoleResolved, isMentorSession]
  );

  const skipFeedbackItem = useCallback(
    (reservation: Reservation) => {
      if (!rawUserId) return;
      markSessionReservationSkipped(rawUserId, reservation.id);
      pruneCompletedAndSkippedItems(rawUserId, !canPresentQueueRef.current);
    },
    [rawUserId, pruneCompletedAndSkippedItems]
  );

  const dismissQueue = useCallback(() => {
    if (rawUserId) {
      const persisted = getSessionPendingFeedbackState(rawUserId);
      const hasSkippedOrRemaining =
        activeQueueIdsRef.current.length > 0 || persisted.skippedIds.length > 0;

      if (hasSkippedOrRemaining) {
        markSessionPendingFeedbackDismissed(
          rawUserId,
          activeQueueIdsRef.current
        );
      } else {
        markSessionPendingFeedbackChecked(rawUserId, false);
      }
    }
    activeQueueIdsRef.current = [];
    setQueueItems(null);
  }, [rawUserId]);

  return {
    queueItems: canPresentQueue ? queueItems : null,
    submitFeedbackItem,
    skipFeedbackItem,
    dismissQueue,
  };
}
