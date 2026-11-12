'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { clearUserProfileDtoCache } from '@/hooks/user/user-data/userProfileDtoCache';
import { trackEvent } from '@/lib/analytics';
import {
  clearAllSessionPendingFeedbackState,
  getSessionPendingFeedbackState,
  isAuthResetRoute,
  markSessionPendingFeedbackChecked,
  markSessionPendingFeedbackDismissed,
  markSessionReservationSkipped,
  shouldSuppressPendingFeedbackPopup,
} from '@/lib/reservation/pendingFeedbackGuard';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import {
  fetchPendingFeedbackReservations,
  submitReservationFeedback,
} from '@/services/reservations';
import type { Reservation } from '@/types/reservation';
import type {
  FeedbackViewerRole,
  SubmitReservationFeedbackRequest,
} from '@/types/reservationFeedback';

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

  const rawUserId = session?.user?.id ? String(session.user.id) : '';
  const isMentorSession = Boolean(session?.user?.isMentor);
  const isOnboardingIncomplete = session?.user?.onBoarding === false;
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
      const skippedSet = new Set(
        getSessionPendingFeedbackState(rawUserId).skippedIds
      );
      const remaining = prev.filter(
        (item) =>
          !skippedSet.has(item.id) && !submittedIdsRef.current.has(item.id)
      );
      activeQueueIdsRef.current = remaining.map((item) => item.id);
      return remaining.length > 0 ? remaining : null;
    });
  }, [isSuppressed, rawUserId]);

  // Clear per-login skip state whenever user logs out, switches account, or enters /auth/* sign-in flow.
  useEffect(() => {
    if (status === 'unauthenticated' || isAuthResetRoute(pathname)) {
      clearAllSessionPendingFeedbackState();
      prevUserIdRef.current = null;
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
      isOnboardingIncomplete ||
      hasSessionError ||
      isSuppressed
    ) {
      return;
    }

    const sessionState = getSessionPendingFeedbackState(rawUserId);
    if (sessionState.dismissed) {
      return;
    }

    // Once fetched in the current login session, do not re-fetch on SPA route hops.
    if (sessionState.checked) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const items = await fetchPendingFeedbackReservations({
          userId: rawUserId,
          signal: controller.signal,
        });

        if (cancelled || controller.signal.aborted) {
          return;
        }

        const skippedSet = new Set(
          getSessionPendingFeedbackState(rawUserId).skippedIds
        );
        const remaining = items.filter(
          (item) =>
            !skippedSet.has(item.id) && !submittedIdsRef.current.has(item.id)
        );

        markSessionPendingFeedbackChecked(rawUserId);

        if (remaining.length > 0) {
          activeQueueIdsRef.current = remaining.map((item) => item.id);
          setQueueItems(remaining);
        } else {
          activeQueueIdsRef.current = [];
          setQueueItems(null);
        }
      } catch {
        if (!cancelled && !controller.signal.aborted) {
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
    isOnboardingIncomplete,
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

      const roleForReservation: FeedbackViewerRole =
        targetReservation.viewerRole === 'MENTOR'
          ? 'mentor'
          : targetReservation.viewerRole === 'MENTEE'
            ? 'mentee'
            : isMentorSession
              ? 'mentor'
              : 'mentee';

      await submitReservationFeedback({
        reservation: targetReservation,
        myUserId: rawUserId,
        myRole: roleForReservation,
        payload,
      });

      submittedIdsRef.current.add(targetReservation.id);
      activeQueueIdsRef.current = activeQueueIdsRef.current.filter(
        (id) => id !== targetReservation.id
      );

      if (payload.meeting_happened || roleForReservation === 'mentor') {
        const targetMentorId =
          roleForReservation === 'mentor'
            ? Number(rawUserId)
            : Number(resolveCounterpartyId(targetReservation, rawUserId));
        if (Number.isFinite(targetMentorId) && targetMentorId > 0) {
          clearUserProfileDtoCache(targetMentorId, 'zh_TW');
          clearUserProfileDtoCache(targetMentorId, 'en_US');
        }
      }

      trackEvent({
        name: 'reservation_feedback_submitted',
        feature: 'reservation',
        metadata: { meeting_happened: payload.meeting_happened },
      });
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
