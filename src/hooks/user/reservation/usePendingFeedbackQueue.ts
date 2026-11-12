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
  markSessionReservationSubmitted,
  shouldSuppressPendingFeedbackPopup,
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
  const isMentorSession = Boolean(session?.user?.isMentor);
  const isOnboardingComplete = session?.user?.onBoarding === true;
  const hasSessionError = Boolean(session?.error);

  const isSuppressed = shouldSuppressPendingFeedbackPopup({
    pathname,
    searchParams,
  });

  // When temporarily yielding to a suppressed route mid-queue, prune any items
  // already submitted or skipped while the modal was open so returning to an
  // eligible route only surfaces remaining items.
  useEffect(() => {
    if (!isSuppressed || !rawUserId) {
      return;
    }

    setQueueItems((prev) => {
      if (!prev || prev.length === 0) {
        return prev;
      }
      const persisted = getSessionPendingFeedbackState(rawUserId);
      const excludedIds = new Set([
        ...persisted.skippedIds,
        ...persisted.submittedIds,
        ...Array.from(submittedIdsRef.current),
      ]);
      const remaining = prev.filter((item) => !excludedIds.has(item.id));
      activeQueueIdsRef.current = remaining.map((item) => item.id);
      return remaining.length > 0 ? remaining : null;
    });
  }, [isSuppressed, rawUserId]);

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

      submittedIdsRef.current.add(targetReservation.id);
      activeQueueIdsRef.current = activeQueueIdsRef.current.filter(
        (id) => id !== targetReservation.id
      );
      markSessionReservationSubmitted(
        rawUserId,
        targetReservation.id,
        activeQueueIdsRef.current.length === 0
      );
    },
    [rawUserId, isMentorSession]
  );

  const skipFeedbackItem = useCallback(
    (reservation: Reservation) => {
      if (!rawUserId) return;
      markSessionReservationSkipped(rawUserId, reservation.id);
      activeQueueIdsRef.current = activeQueueIdsRef.current.filter(
        (id) => id !== reservation.id
      );
    },
    [rawUserId]
  );

  const dismissQueue = useCallback(() => {
    if (rawUserId) {
      markSessionPendingFeedbackDismissed(rawUserId, activeQueueIdsRef.current);
    }
    activeQueueIdsRef.current = [];
    setQueueItems(null);
  }, [rawUserId]);

  return {
    queueItems: isSuppressed ? null : queueItems,
    submitFeedbackItem,
    skipFeedbackItem,
    dismissQueue,
  };
}
