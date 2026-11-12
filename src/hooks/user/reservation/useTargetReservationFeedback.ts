'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { isAbortError } from '@/lib/errorUtils';
import {
  fetchAllReservationsForState,
  fetchReservationFeedback,
} from '@/services/reservations';
import type { Reservation } from '@/types/reservation';
import type {
  ReservationFeedback,
  SingleReservationFeedbackResult,
} from '@/types/reservationFeedback';

import type { ReservationRole } from './useReservationData';

export interface UseTargetReservationFeedbackOptions {
  userId: string | undefined;
  userRole: ReservationRole;
  isMentor?: boolean;
  isSessionLoading?: boolean;
  reservationId: string | null | undefined;
  history: Reservation[];
  isHistoryLoaded: boolean;
  hasMoreHistory?: boolean;
}

export interface UseTargetReservationFeedbackReturn {
  historyWithTargetFeedback: Reservation[];
  targetReservationId: string | null;
  autoOpenReservationId: string | null;
  isResolvingRole: boolean;
}

interface ResolvedFeedbackLookupState {
  key: string;
  status: 'resolved';
  result: SingleReservationFeedbackResult | null;
  hasBaseline: boolean;
  baselineFeedback: ReservationFeedback | undefined;
}

type FeedbackLookupState =
  { key: string; status: 'loading' } | ResolvedFeedbackLookupState;

interface MentorFallbackState {
  key: string;
  status: 'checking' | 'redirecting' | 'not-found';
}

function pickEffectiveFeedback(
  itemFeedback: ReservationFeedback | undefined,
  singleFeedback: ReservationFeedback | undefined,
  lookup: ResolvedFeedbackLookupState | null
): ReservationFeedback | undefined {
  if (!singleFeedback) {
    return itemFeedback;
  }
  if (!itemFeedback) {
    return singleFeedback;
  }
  if (lookup?.hasBaseline && itemFeedback !== lookup.baselineFeedback) {
    return itemFeedback;
  }
  if (itemFeedback.nextStep === null && singleFeedback.nextStep === 'ANSWER') {
    return itemFeedback;
  }
  if (singleFeedback.nextStep === null && itemFeedback.nextStep === 'ANSWER') {
    return singleFeedback;
  }
  if (
    itemFeedback.rating &&
    singleFeedback.rating &&
    itemFeedback.rating.updatedAt > singleFeedback.rating.updatedAt
  ) {
    return itemFeedback;
  }
  return singleFeedback;
}

export function useTargetReservationFeedback({
  userId,
  userRole,
  isMentor = false,
  isSessionLoading = false,
  reservationId,
  history,
  isHistoryLoaded,
  hasMoreHistory = false,
}: UseTargetReservationFeedbackOptions): UseTargetReservationFeedbackReturn {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const historyRef = useRef(history);
  historyRef.current = history;

  const userRoleRef = useRef(userRole);
  userRoleRef.current = userRole;

  const normalizedReservationId = useMemo(() => {
    const trimmed = reservationId?.trim();
    return trimmed ? trimmed : null;
  }, [reservationId]);

  const lookupKey =
    userId && normalizedReservationId
      ? `${userId}:${normalizedReservationId}`
      : null;

  const [lookupState, setLookupState] = useState<FeedbackLookupState | null>(
    null
  );
  const [mentorFallbackState, setMentorFallbackState] =
    useState<MentorFallbackState | null>(null);
  const mentorFallbackCheckedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lookupKey || !userId || !normalizedReservationId) {
      return;
    }

    const controller = new AbortController();
    setLookupState((prev) => {
      if (prev === null) return prev;
      if (prev.key === lookupKey && prev.status === 'loading') return prev;
      return { key: lookupKey, status: 'loading' };
    });

    fetchReservationFeedback({
      userId,
      reservationId: normalizedReservationId,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;

        if (result?.viewerRole && result.viewerRole !== userRoleRef.current) {
          const params = new URLSearchParams();
          params.set('tab', 'history');
          params.set('reservation_id', normalizedReservationId);
          routerRef.current.replace(
            `/reservation/${result.viewerRole}?${params.toString()}`,
            { scroll: false }
          );
        }

        const existingItem = historyRef.current.find(
          (it) => it.id === normalizedReservationId
        );
        setLookupState({
          key: lookupKey,
          status: 'resolved',
          result,
          hasBaseline: Boolean(existingItem),
          baselineFeedback: existingItem?.feedback,
        });
      })
      .catch((error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        const existingItem = historyRef.current.find(
          (it) => it.id === normalizedReservationId
        );
        // Graceful fallback to reservation history list when single-item API fails
        setLookupState({
          key: lookupKey,
          status: 'resolved',
          result: null,
          hasBaseline: Boolean(existingItem),
          baselineFeedback: existingItem?.feedback,
        });
      });

    return () => {
      controller.abort();
    };
  }, [lookupKey, normalizedReservationId, userId]);

  const currentLookup =
    lookupKey && lookupState?.key === lookupKey ? lookupState : null;
  const resolvedLookup =
    currentLookup?.status === 'resolved' ? currentLookup : null;

  const targetHistoryItem = useMemo(() => {
    if (!normalizedReservationId) return undefined;
    return history.find((it) => it.id === normalizedReservationId);
  }, [history, normalizedReservationId]);

  useEffect(() => {
    if (!resolvedLookup || resolvedLookup.hasBaseline || !targetHistoryItem) {
      return;
    }

    setLookupState((prev) => {
      if (
        !prev ||
        prev.key !== resolvedLookup.key ||
        prev.status !== 'resolved' ||
        prev.hasBaseline
      ) {
        return prev;
      }
      return {
        ...prev,
        hasBaseline: true,
        baselineFeedback: targetHistoryItem.feedback,
      };
    });
  }, [resolvedLookup, targetHistoryItem]);

  // If the user is also a Mentor and the reservation is not in MENTEE_HISTORY
  // after all Mentee history pages have loaded, check MENTOR_HISTORY across
  // pages so shared `/reservation/history?reservation_id={id}` links route
  // Mentor-side meetings to `/reservation/mentor?tab=history`.
  useEffect(() => {
    if (
      !lookupKey ||
      !userId ||
      !normalizedReservationId ||
      userRole !== 'mentee' ||
      !isMentor ||
      !isHistoryLoaded ||
      hasMoreHistory ||
      !resolvedLookup ||
      resolvedLookup.result?.viewerRole
    ) {
      return;
    }

    if (targetHistoryItem) {
      return;
    }

    if (mentorFallbackCheckedKeyRef.current === lookupKey) {
      return;
    }
    mentorFallbackCheckedKeyRef.current = lookupKey;
    let settled = false;

    setMentorFallbackState({ key: lookupKey, status: 'checking' });

    const controller = new AbortController();
    fetchAllReservationsForState({
      userId,
      state: 'MENTOR_HISTORY',
      signal: controller.signal,
      shouldStop: (items) =>
        items.some((it) => it.id === normalizedReservationId),
    })
      .then((items) => {
        if (controller.signal.aborted) return;
        settled = true;
        if (items.some((it) => it.id === normalizedReservationId)) {
          setMentorFallbackState({ key: lookupKey, status: 'redirecting' });
          const params = new URLSearchParams();
          params.set('tab', 'history');
          params.set('reservation_id', normalizedReservationId);
          routerRef.current.replace(
            `/reservation/mentor?${params.toString()}`,
            { scroll: false }
          );
        } else {
          setMentorFallbackState({ key: lookupKey, status: 'not-found' });
        }
      })
      .catch((error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        // Ignore fallback lookup errors
        settled = true;
        setMentorFallbackState({ key: lookupKey, status: 'not-found' });
      });

    return () => {
      controller.abort();
      if (!settled && mentorFallbackCheckedKeyRef.current === lookupKey) {
        mentorFallbackCheckedKeyRef.current = null;
      }
    };
  }, [
    hasMoreHistory,
    isHistoryLoaded,
    isMentor,
    lookupKey,
    normalizedReservationId,
    resolvedLookup,
    targetHistoryItem,
    userId,
    userRole,
  ]);

  const currentMentorFallback =
    lookupKey && mentorFallbackState?.key === lookupKey
      ? mentorFallbackState
      : null;

  const isResolvingRole = useMemo<boolean>(() => {
    if (!normalizedReservationId) {
      return false;
    }

    const resolvedViewerRole = resolvedLookup?.result?.viewerRole;
    if (resolvedViewerRole && resolvedViewerRole !== userRole) {
      return true;
    }

    if (userRole !== 'mentee') {
      return false;
    }

    if (isSessionLoading && !userId) {
      return true;
    }

    if (!isMentor || !userId) {
      return false;
    }

    if (resolvedViewerRole === 'mentee' || Boolean(targetHistoryItem)) {
      return false;
    }

    if (!resolvedLookup || !isHistoryLoaded || hasMoreHistory) {
      return true;
    }

    return currentMentorFallback?.status !== 'not-found';
  }, [
    currentMentorFallback,
    hasMoreHistory,
    isHistoryLoaded,
    isMentor,
    isSessionLoading,
    normalizedReservationId,
    resolvedLookup,
    targetHistoryItem,
    userId,
    userRole,
  ]);

  const singleFeedback = resolvedLookup?.result?.feedback;

  const historyWithTargetFeedback = useMemo<Reservation[]>(() => {
    if (!normalizedReservationId || !singleFeedback) {
      return history;
    }

    let didUpdate = false;
    const mapped = history.map((item) => {
      if (item.id !== normalizedReservationId) {
        return item;
      }
      const effectiveFeedback = pickEffectiveFeedback(
        item.feedback,
        singleFeedback,
        resolvedLookup
      );
      if (effectiveFeedback === item.feedback) {
        return item;
      }
      didUpdate = true;
      return {
        ...item,
        feedback: effectiveFeedback,
      };
    });

    return didUpdate ? mapped : history;
  }, [history, normalizedReservationId, resolvedLookup, singleFeedback]);

  const autoOpenReservationId = useMemo<string | null>(() => {
    if (!normalizedReservationId || !resolvedLookup) {
      return null;
    }

    const targetItem = historyWithTargetFeedback.find(
      (item) => item.id === normalizedReservationId
    );
    if (!targetItem || targetItem.cancelledBy) {
      return null;
    }

    return targetItem.feedback?.nextStep === 'ANSWER'
      ? normalizedReservationId
      : null;
  }, [historyWithTargetFeedback, normalizedReservationId, resolvedLookup]);

  return {
    historyWithTargetFeedback,
    targetReservationId: normalizedReservationId,
    autoOpenReservationId,
    isResolvingRole,
  };
}
