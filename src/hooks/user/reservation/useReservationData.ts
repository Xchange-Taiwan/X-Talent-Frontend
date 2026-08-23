'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useMemo, useState } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import { trackEvent } from '@/lib/analytics';
import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import { captureFlowFailure } from '@/lib/monitoring';
import { fetchReservations, ReservationState } from '@/services/reservations';
import { Reservation } from '@/types/reservation';

export type ReservationRole = 'mentee' | 'mentor';

export interface NextTokens {
  upcoming: number;
  pending: number;
  history: number;
}

export interface ReservationData {
  upcoming: Reservation[];
  pending: Reservation[];
  history: Reservation[];
  nextTokens: NextTokens;
}

export type ListKey = 'upcoming' | 'pending' | 'history';

const ROLE_STATES: Record<
  ReservationRole,
  Record<ListKey, ReservationState>
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

export type ListLoadState = 'idle' | 'loading' | 'ready';

export type InitialListState = Record<ListKey, ListLoadState>;

export type LoadingMoreStates = Record<ListKey, boolean>;

const EMPTY_LOADING_MORE: LoadingMoreStates = {
  upcoming: false,
  pending: false,
  history: false,
};

// Backend orders every list by dtend desc, which is correct for HISTORY
// (most recent past first) but reverses what users expect for UPCOMING /
// PENDING — those should lead with the meeting closest to now. Resort
// client-side by dtstart ascending so the closest reservation sits at the top.
const sortByDtstartAsc = (items: Reservation[]): Reservation[] =>
  [...items].sort((a, b) => a.dtstart - b.dtstart);

export interface FetchReservationsResult {
  items: Reservation[];
  next_dtend: number;
}

export const reservationCache = createKeyedCache<
  string,
  FetchReservationsResult
>();
export const reservationReadManager = new AsyncReadManager<
  string,
  FetchReservationsResult
>(reservationCache);

export interface UseReservationDataReturn {
  data: ReservationData | null;
  initialState: InitialListState;
  isLoading: boolean;
  loadingMoreStates: LoadingMoreStates;
  isLoadingHistory: boolean;
  isHistoryLoaded: boolean;
  myUserId: string;
  loadMore: (tab: ListKey) => Promise<void>;
  loadHistory: () => Promise<void>;
  onMutationSuccess: (id: string, affectedTabs: ListKey[]) => void;
  /**
   * Refetch the affected tabs without removing the item first — for a failed
   * mutation (e.g. a 409 version conflict) where the item is still present
   * but its data (including `version`) is now stale, unlike
   * `onMutationSuccess` which assumes the item moved out of the tab.
   */
  refetchOnConflict: (affectedTabs: ListKey[]) => void;
}

function getReservationCacheKey(
  userId: string | number | null | undefined,
  state: string
): string | null {
  return userId ? `${userId}_${state}` : null;
}

export function useReservationData({
  role,
}: {
  role: ReservationRole;
}): UseReservationDataReturn {
  const { data: session } = useSession();
  const myUserId = session?.user?.id ? String(session.user.id) : '';
  const states = ROLE_STATES[role];

  const [loadingMoreStates, setLoadingMoreStates] =
    useState<LoadingMoreStates>(EMPTY_LOADING_MORE);
  const [historyActive, setHistoryActive] = useState(false);

  const upcomingKey = getReservationCacheKey(myUserId, states.upcoming);
  const pendingKey = getReservationCacheKey(myUserId, states.pending);
  const historyKey = historyActive
    ? getReservationCacheKey(myUserId, states.history)
    : null;

  const createReservationFetcher = useCallback(
    (
      state: ReservationState,
      flow: string,
      step: string,
      onError?: () => void
    ) => {
      return async (signal: AbortSignal) => {
        try {
          return await fetchReservations({
            userId: myUserId,
            state,
            signal,
          });
        } catch (err) {
          const isAbort =
            signal.aborted ||
            (err instanceof DOMException && err.name === 'AbortError') ||
            (err instanceof Error && err.name === 'AbortError');
          if (isAbort) {
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
          onError?.();
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
        'history',
        () => setHistoryActive(false)
      ),
    [createReservationFetcher, states.history]
  );

  const { data: upcomingResult, isLoading: isUpcomingLoading } = useAsyncRead(
    reservationReadManager,
    upcomingKey,
    fetchUpcoming
  );

  const { data: pendingResult, isLoading: isPendingLoading } = useAsyncRead(
    reservationReadManager,
    pendingKey,
    fetchPending
  );

  const { data: historyResult, isLoading: isHistoryLoading } = useAsyncRead(
    reservationReadManager,
    historyKey,
    fetchHistory
  );

  const isHistoryLoaded = historyResult !== null && !isHistoryLoading;

  const upcomingSorted = useMemo(() => {
    return upcomingResult ? sortByDtstartAsc(upcomingResult.items) : [];
  }, [upcomingResult]);

  const pendingSorted = useMemo(() => {
    return pendingResult ? sortByDtstartAsc(pendingResult.items) : [];
  }, [pendingResult]);

  const historyItems = useMemo(() => {
    return historyResult ? historyResult.items : [];
  }, [historyResult]);

  const data = useMemo<ReservationData | null>(() => {
    if (!myUserId) return null;
    if (!upcomingResult && !pendingResult) return null;

    return {
      upcoming: upcomingSorted,
      pending: pendingSorted,
      history: historyItems,
      nextTokens: {
        upcoming: upcomingResult ? upcomingResult.next_dtend : 0,
        pending: pendingResult ? pendingResult.next_dtend : 0,
        history: historyResult ? historyResult.next_dtend : 0,
      },
    };
  }, [
    myUserId,
    upcomingResult,
    pendingResult,
    historyResult,
    upcomingSorted,
    pendingSorted,
    historyItems,
  ]);

  const refetchStates = useCallback(
    async (targets: ReservationState[]) => {
      if (!myUserId) return;

      const ownStates = new Set<ReservationState>([
        states.upcoming,
        states.pending,
        states.history,
      ]);
      const filtered = targets.filter((state) => {
        if (!ownStates.has(state)) return false;
        if (state === states.history && !historyActive) return false;
        return true;
      });
      if (filtered.length === 0) return;

      try {
        const results = await Promise.all(
          filtered.map((state) =>
            fetchReservations({ userId: myUserId, state })
          )
        );

        filtered.forEach((state, idx) => {
          const key = getReservationCacheKey(myUserId, state)!;
          reservationReadManager.set(key, results[idx]);
        });
      } catch (err) {
        captureFlowFailure({
          flow: 'reservation_refetch',
          step: 'fetch_states',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to refetch reservations',
        });
        console.error('[useReservationData] refetch error:', err);
      }
    },
    [myUserId, states, historyActive]
  );

  const onMutationSuccess = useCallback(
    (id: string, affectedTabs: ListKey[]) => {
      affectedTabs.forEach((tab) => {
        const key = getReservationCacheKey(myUserId, states[tab]);
        if (!key) return;
        const cached = reservationReadManager.get(key);
        if (cached) {
          const updated = {
            ...cached,
            items: cached.items.filter((it) => it.id !== id),
          };
          reservationReadManager.set(key, updated);
        }
      });

      const affectedStates = affectedTabs.map((tab) => states[tab]);
      void refetchStates(affectedStates);
    },
    [myUserId, states, refetchStates]
  );

  const refetchOnConflict = useCallback(
    (affectedTabs: ListKey[]) => {
      const affectedStates = affectedTabs.map((tab) => states[tab]);
      void refetchStates(affectedStates);
    },
    [states, refetchStates]
  );

  const loadHistory = useCallback(async () => {
    if (!myUserId || (historyActive && isHistoryLoaded) || isHistoryLoading)
      return;
    setHistoryActive(true);
    trackEvent({
      name: 'reservation_history_loaded',
      feature: 'reservation',
    });
  }, [myUserId, historyActive, isHistoryLoading, isHistoryLoaded]);

  const loadMore = useCallback(
    async (tab: ListKey): Promise<void> => {
      if (!myUserId) return;
      const key = getReservationCacheKey(myUserId, states[tab])!;
      const currentData = reservationReadManager.get(key);
      if (!currentData) return;
      const cursor = currentData.next_dtend;
      if (cursor === 0) return;

      setLoadingMoreStates((prev) => ({ ...prev, [tab]: true }));
      try {
        const result = await fetchReservations({
          userId: myUserId,
          state: states[tab],
          nextDtend: cursor,
        });

        const merged = [...currentData.items, ...result.items];
        reservationReadManager.set(key, {
          items: merged,
          next_dtend: result.next_dtend,
        });

        trackEvent({ name: 'reservation_load_more', feature: 'reservation' });
      } catch (err) {
        captureFlowFailure({
          flow: 'reservation_load_more',
          step: 'fetch_page',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to load more reservations',
        });
        console.error('[useReservationData] loadMore error:', err);
      } finally {
        setLoadingMoreStates((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [myUserId, states]
  );

  const initialUpcoming: ListLoadState =
    upcomingKey === null
      ? 'idle'
      : isUpcomingLoading && !upcomingResult
        ? 'loading'
        : 'ready';
  const initialPending: ListLoadState =
    pendingKey === null
      ? 'idle'
      : isPendingLoading && !pendingResult
        ? 'loading'
        : 'ready';
  const historyLoadState: ListLoadState = !historyActive
    ? 'idle'
    : isHistoryLoading && !historyResult
      ? 'loading'
      : isHistoryLoaded
        ? 'ready'
        : 'idle';

  const initialState: InitialListState = {
    upcoming: initialUpcoming,
    pending: initialPending,
    history: historyLoadState,
  };

  const isLoading =
    initialUpcoming === 'loading' || initialPending === 'loading';

  return {
    data,
    initialState,
    isLoading,
    loadingMoreStates,
    isLoadingHistory: isHistoryLoading,
    isHistoryLoaded,
    myUserId,
    loadMore,
    loadHistory,
    onMutationSuccess,
    refetchOnConflict,
  };
}
