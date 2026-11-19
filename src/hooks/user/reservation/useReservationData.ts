'use client';

import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useMemo, useState } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import { getSafeErrorMessage, isAbortError } from '@/lib/errorUtils';
import { isFeedbackEnabled } from '@/lib/featureFlags';
import { captureFlowFailure } from '@/lib/monitoring';
import { partitionReservationTabSlices } from '@/lib/reservation/reservationLifecyclePolicy';
import {
  type ReservationReadKey,
  reservationReadModel,
} from '@/lib/reservation/reservationReadModel';
import {
  parseReservationSearchParams,
  type ReservationTabParam,
} from '@/lib/reservation/reservationRoutes';
import { fetchReservations, ReservationState } from '@/services/reservations';
import { Reservation } from '@/types/reservation';

export type ReservationRole = 'mentee' | 'mentor';

const ROLE_STATES: Record<
  ReservationRole,
  Record<ReservationTabParam, ReservationState>
> = {
  mentee: {
    upcoming: 'MENTEE_UPCOMING',
    pending: 'MENTEE_PENDING',
    history: 'MENTEE_HISTORY',
  },
  mentor: {
    upcoming: 'MENTOR_UPCOMING',
    pending: 'MENTOR_PENDING',
    history: 'MENTOR_HISTORY',
  },
};

type LoadingMoreStates = Record<ReservationTabParam, boolean>;

const EMPTY_LOADING_MORE: LoadingMoreStates = {
  upcoming: false,
  pending: false,
  history: false,
};

export interface ReservationTabSlice {
  items: Reservation[];
  badgeCount: number;
  showBadge: boolean;
  isInitialLoading: boolean;
  isFetching: boolean;
  isLoadingMore: boolean;
  isLoaded: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export interface ReservationDashboardTabs {
  pending: ReservationTabSlice;
  upcoming: ReservationTabSlice;
  history: ReservationTabSlice;
}

export interface UseReservationDashboardOptions {
  role: ReservationRole;
}

export interface UseReservationDashboardReturn {
  activeTab: ReservationTabParam;
  myUserId: string;
  tabs: ReservationDashboardTabs;
  loadHistory: () => Promise<void>;
}

interface RetainedTabCounts {
  scopeKey: string;
  upcoming: number;
  pending: number;
  history: number;
  hasHistoryLoadedOnce: boolean;
}

function reconcileRetainedCounts(
  prev: RetainedTabCounts,
  nextInput: {
    scopeKey: string;
    upcomingCount: number;
    pendingCount: number;
    historyCount: number;
    isUpcomingLoading: boolean;
    isPendingLoading: boolean;
    isHistoryLoading: boolean;
    isHistoryLoaded: boolean;
  }
): RetainedTabCounts {
  const base: RetainedTabCounts =
    prev.scopeKey === nextInput.scopeKey
      ? prev
      : {
          scopeKey: nextInput.scopeKey,
          upcoming: nextInput.upcomingCount,
          pending: nextInput.pendingCount,
          history: nextInput.historyCount,
          hasHistoryLoadedOnce:
            nextInput.isHistoryLoaded && !nextInput.isHistoryLoading,
        };

  const isAnyTabLoading =
    nextInput.isUpcomingLoading ||
    nextInput.isPendingLoading ||
    nextInput.isHistoryLoading;

  const upcoming =
    !nextInput.isUpcomingLoading &&
    (nextInput.upcomingCount > 0 || !isAnyTabLoading)
      ? nextInput.upcomingCount
      : base.upcoming;

  const pending =
    !nextInput.isPendingLoading &&
    (nextInput.pendingCount > 0 || !isAnyTabLoading)
      ? nextInput.pendingCount
      : base.pending;

  const historySettled =
    nextInput.isHistoryLoaded && !nextInput.isHistoryLoading;
  const history = historySettled ? nextInput.historyCount : base.history;
  const hasHistoryLoadedOnce = base.hasHistoryLoadedOnce || historySettled;

  if (
    prev.scopeKey === nextInput.scopeKey &&
    prev.upcoming === upcoming &&
    prev.pending === pending &&
    prev.history === history &&
    prev.hasHistoryLoadedOnce === hasHistoryLoadedOnce
  ) {
    return prev;
  }

  return {
    scopeKey: nextInput.scopeKey,
    upcoming,
    pending,
    history,
    hasHistoryLoadedOnce,
  };
}

function toReservationReadKey(
  userId: string | number | null | undefined,
  state: ReservationState
): ReservationReadKey | null {
  return userId ? { userId: String(userId), state } : null;
}

export function useReservationDashboard({
  role,
}: UseReservationDashboardOptions): UseReservationDashboardReturn {
  const searchParams = useSearchParams();
  const parsedParams = parseReservationSearchParams(searchParams);
  const feedbackEnabled = isFeedbackEnabled();
  const forceHistoryTab =
    feedbackEnabled &&
    (parsedParams.isFeedbackQueue ||
      parsedParams.deepLinkReservationId !== null);
  const activeTab: ReservationTabParam = forceHistoryTab
    ? 'history'
    : (parsedParams.tab ?? 'pending');

  const { data: session, status } = useSession();
  const [retainedUserId, setRetainedUserId] = useState('');
  const currentSessionUserId = session?.user?.id ? String(session.user.id) : '';
  if (currentSessionUserId && retainedUserId !== currentSessionUserId) {
    setRetainedUserId(currentSessionUserId);
  } else if (status === 'unauthenticated' && retainedUserId !== '') {
    setRetainedUserId('');
  }
  const myUserId =
    currentSessionUserId ||
    (status === 'unauthenticated' ? '' : retainedUserId);
  const scopeKey = `${role}:${myUserId}`;
  const states = ROLE_STATES[role];

  const [loadingMoreStates, setLoadingMoreStates] =
    useState<LoadingMoreStates>(EMPTY_LOADING_MORE);
  const [historyLatchedScope, setHistoryLatchedScope] = useState<string | null>(
    () => (activeTab === 'history' && myUserId ? scopeKey : null)
  );

  if (activeTab === 'history' && myUserId && historyLatchedScope !== scopeKey) {
    setHistoryLatchedScope(scopeKey);
  }

  const isHistoryEnabled =
    activeTab === 'history' || historyLatchedScope === scopeKey;

  // useAsyncRead compares keys by reference to detect a "key changed" edge
  // during render, so these must stay referentially stable across renders
  // when (userId, state) hasn't actually changed.
  const upcomingKey = useMemo(
    () => toReservationReadKey(myUserId, states.upcoming),
    [myUserId, states.upcoming]
  );
  const pendingKey = useMemo(
    () => toReservationReadKey(myUserId, states.pending),
    [myUserId, states.pending]
  );
  const historyKey = useMemo(
    () =>
      isHistoryEnabled ? toReservationReadKey(myUserId, states.history) : null,
    [isHistoryEnabled, myUserId, states.history]
  );

  const createReservationFetcher = useCallback(
    (state: ReservationState, flow: string, step: string) => {
      return async (signal: AbortSignal) => {
        try {
          return await fetchReservations({
            userId: myUserId,
            state,
            signal,
          });
        } catch (err) {
          if (isAbortError(err, signal)) {
            throw err;
          }
          captureFlowFailure({
            flow,
            step,
            message:
              err instanceof Error
                ? err.message
                : `Failed to fetch ${step} reservations`,
          });
          throw err;
        }
      };
    },
    [myUserId]
  );

  const fetchUpcoming = useMemo(
    () =>
      createReservationFetcher(
        states.upcoming,
        'reservation_initial_fetch',
        'upcoming'
      ),
    [createReservationFetcher, states.upcoming]
  );

  const fetchPending = useMemo(
    () =>
      createReservationFetcher(
        states.pending,
        'reservation_initial_fetch',
        'pending'
      ),
    [createReservationFetcher, states.pending]
  );

  const fetchHistory = useMemo(
    () =>
      createReservationFetcher(
        states.history,
        'reservation_history_fetch',
        'history'
      ),
    [createReservationFetcher, states.history]
  );

  const { data: upcomingResult, isLoading: isUpcomingLoading } = useAsyncRead(
    reservationReadModel,
    upcomingKey,
    fetchUpcoming
  );

  const { data: pendingResult, isLoading: isPendingLoading } = useAsyncRead(
    reservationReadModel,
    pendingKey,
    fetchPending
  );

  const {
    data: historyResult,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useAsyncRead(reservationReadModel, historyKey, fetchHistory);

  const isHistoryLoaded = historyResult !== null && !isHistoryLoading;

  const {
    upcoming: upcomingSorted,
    pending: pendingSorted,
    history: historyItems,
  } = useMemo(
    () =>
      partitionReservationTabSlices({
        upcomingItems: upcomingResult?.items,
        pendingItems: pendingResult?.items,
        historyItems: historyResult?.items,
      }),
    [upcomingResult, pendingResult, historyResult]
  );

  const [retainedCounts, setRetainedCounts] = useState<RetainedTabCounts>(() =>
    reconcileRetainedCounts(
      {
        scopeKey,
        upcoming: 0,
        pending: 0,
        history: 0,
        hasHistoryLoadedOnce: false,
      },
      {
        scopeKey,
        upcomingCount: upcomingSorted.length,
        pendingCount: pendingSorted.length,
        historyCount: historyItems.length,
        isUpcomingLoading,
        isPendingLoading,
        isHistoryLoading,
        isHistoryLoaded,
      }
    )
  );

  const nextRetained = reconcileRetainedCounts(retainedCounts, {
    scopeKey,
    upcomingCount: upcomingSorted.length,
    pendingCount: pendingSorted.length,
    historyCount: historyItems.length,
    isUpcomingLoading,
    isPendingLoading,
    isHistoryLoading,
    isHistoryLoaded,
  });

  if (nextRetained !== retainedCounts) {
    setRetainedCounts(nextRetained);
  }

  const isAnyTabLoading =
    isUpcomingLoading || isPendingLoading || isHistoryLoading;

  const upcomingBadgeCount =
    upcomingSorted.length === 0 && isAnyTabLoading
      ? nextRetained.upcoming
      : upcomingSorted.length;
  const pendingBadgeCount =
    pendingSorted.length === 0 && isAnyTabLoading
      ? nextRetained.pending
      : pendingSorted.length;
  const showHistoryBadge = isHistoryLoaded || nextRetained.hasHistoryLoadedOnce;
  const historyBadgeCount =
    (!isHistoryLoaded || isHistoryLoading) &&
    historyItems.length === 0 &&
    nextRetained.hasHistoryLoadedOnce
      ? nextRetained.history
      : historyItems.length;

  const loadHistory = useCallback(async () => {
    if (!myUserId || isHistoryLoaded || isHistoryLoading) return;
    if (historyKey !== null) {
      refetchHistory();
      return;
    }
    setHistoryLatchedScope(scopeKey);
  }, [
    myUserId,
    isHistoryLoaded,
    isHistoryLoading,
    historyKey,
    refetchHistory,
    scopeKey,
  ]);

  const loadMoreForTab = useCallback(
    async (tab: ReservationTabParam): Promise<void> => {
      if (!myUserId) return;
      const key = toReservationReadKey(myUserId, states[tab])!;

      setLoadingMoreStates((prev) => ({ ...prev, [tab]: true }));
      try {
        await reservationReadModel.loadNextPage(key, (cursor, signal) =>
          fetchReservations({
            userId: myUserId,
            state: states[tab],
            nextDtend: cursor,
            signal,
          })
        );
      } catch (err) {
        if (!isAbortError(err)) {
          captureFlowFailure({
            flow: 'reservation_load_more',
            step: 'fetch_page',
            message:
              err instanceof Error
                ? err.message
                : 'Failed to load more reservations',
          });
          console.error(
            '[useReservationDashboard] loadMore error:',
            getSafeErrorMessage(err)
          );
        }
      } finally {
        setLoadingMoreStates((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [myUserId, states]
  );

  const loadMorePending = useCallback(
    () => loadMoreForTab('pending'),
    [loadMoreForTab]
  );
  const loadMoreUpcoming = useCallback(
    () => loadMoreForTab('upcoming'),
    [loadMoreForTab]
  );
  const loadMoreHistory = useCallback(
    () => loadMoreForTab('history'),
    [loadMoreForTab]
  );

  const isSessionLoading = status === 'loading' && !myUserId;
  const isPendingInitialLoading =
    isSessionLoading ||
    (pendingKey !== null && isPendingLoading && !pendingResult);
  const isUpcomingInitialLoading =
    isSessionLoading ||
    (upcomingKey !== null && isUpcomingLoading && !upcomingResult);
  const isHistoryInitialLoading =
    isSessionLoading ||
    (historyKey !== null && isHistoryLoading && !historyResult);

  const tabs = useMemo<ReservationDashboardTabs>(
    () => ({
      pending: {
        items: pendingSorted,
        badgeCount: pendingBadgeCount,
        showBadge: true,
        isInitialLoading: isPendingInitialLoading,
        isFetching: isPendingLoading,
        isLoadingMore: loadingMoreStates.pending,
        isLoaded: pendingResult !== null && !isPendingLoading,
        hasMore: (pendingResult?.next_dtend ?? 0) !== 0,
        loadMore: loadMorePending,
      },
      upcoming: {
        items: upcomingSorted,
        badgeCount: upcomingBadgeCount,
        showBadge: true,
        isInitialLoading: isUpcomingInitialLoading,
        isFetching: isUpcomingLoading,
        isLoadingMore: loadingMoreStates.upcoming,
        isLoaded: upcomingResult !== null && !isUpcomingLoading,
        hasMore: (upcomingResult?.next_dtend ?? 0) !== 0,
        loadMore: loadMoreUpcoming,
      },
      history: {
        items: historyItems,
        badgeCount: historyBadgeCount,
        showBadge: showHistoryBadge,
        isInitialLoading: isHistoryInitialLoading,
        isFetching: isHistoryLoading,
        isLoadingMore: loadingMoreStates.history,
        isLoaded: isHistoryLoaded,
        hasMore: (historyResult?.next_dtend ?? 0) !== 0,
        loadMore: loadMoreHistory,
      },
    }),
    [
      pendingSorted,
      pendingBadgeCount,
      isPendingInitialLoading,
      isPendingLoading,
      loadingMoreStates.pending,
      pendingResult,
      loadMorePending,
      upcomingSorted,
      upcomingBadgeCount,
      isUpcomingInitialLoading,
      isUpcomingLoading,
      loadingMoreStates.upcoming,
      upcomingResult,
      loadMoreUpcoming,
      historyItems,
      historyBadgeCount,
      showHistoryBadge,
      isHistoryInitialLoading,
      isHistoryLoading,
      loadingMoreStates.history,
      isHistoryLoaded,
      historyResult,
      loadMoreHistory,
    ]
  );

  return {
    activeTab,
    myUserId,
    tabs,
    loadHistory,
  };
}
