import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Reservation } from '@/components/reservation/types';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import { fetchReservations, ReservationState } from '@/services/reservations';

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

type ListKey = 'upcoming' | 'pending' | 'history';

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

const STATE_TO_LIST_KEY: Record<ReservationState, ListKey> = {
  MENTEE_UPCOMING: 'upcoming',
  MENTEE_PENDING: 'pending',
  MENTEE_HISTORY: 'history',
  MENTOR_UPCOMING: 'upcoming',
  MENTOR_PENDING: 'pending',
  MENTOR_HISTORY: 'history',
};

export type ListLoadState = 'idle' | 'loading' | 'ready';

export type InitialListState = Record<ListKey, ListLoadState>;

export type LoadingMoreStates = Record<ReservationState, boolean>;

const EMPTY_LOADING_MORE: LoadingMoreStates = {
  MENTEE_UPCOMING: false,
  MENTEE_PENDING: false,
  MENTEE_HISTORY: false,
  MENTOR_UPCOMING: false,
  MENTOR_PENDING: false,
  MENTOR_HISTORY: false,
};

const EMPTY_DATA: ReservationData = {
  upcoming: [],
  pending: [],
  history: [],
  nextTokens: { upcoming: 0, pending: 0, history: 0 },
};

export interface UseReservationDataReturn {
  data: ReservationData | null;
  initialState: InitialListState;
  isLoading: boolean;
  loadingMoreStates: LoadingMoreStates;
  isLoadingHistory: boolean;
  isHistoryLoaded: boolean;
  myUserId: string;
  loadMore: (state: ReservationState) => Promise<void>;
  loadHistory: () => Promise<void>;
  onMutationSuccess: (id: string, affectedStates: ReservationState[]) => void;
}

export function useReservationData({
  role,
}: {
  role: ReservationRole;
}): UseReservationDataReturn {
  const { data: session } = useSession();
  const myUserId = session?.user?.id ? String(session.user.id) : '';
  const states = ROLE_STATES[role];

  const [data, setData] = useState<ReservationData | null>(null);
  // Mirror of `data` so loadMore can read the latest cursor synchronously
  // without listing `data` in its deps. Listing `data` rebuilt loadMore (and
  // therefore onMutationSuccess) on every reservation change, swapping the
  // prop identity into ReservationTabs and re-rendering the whole subtree.
  const dataRef = useRef<ReservationData | null>(null);
  const [initialUpcoming, setInitialUpcoming] =
    useState<ListLoadState>('loading');
  const [initialPending, setInitialPending] =
    useState<ListLoadState>('loading');
  const [loadingMoreStates, setLoadingMoreStates] =
    useState<LoadingMoreStates>(EMPTY_LOADING_MORE);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  // Wrapper that keeps dataRef and React state in lock-step. Every write to
  // `data` must go through here so the next loadMore reads a fresh cursor.
  const updateData = useCallback(
    (updater: (prev: ReservationData | null) => ReservationData | null) => {
      setData((prev) => {
        const next = updater(prev);
        dataRef.current = next;
        return next;
      });
    },
    []
  );

  // Initial fetch covers only the role's UPCOMING + PENDING states. HISTORY is
  // lazy and only fetched when the user opens the history tab via loadHistory.
  // Fetches run independently so the active tab (default upcoming) can paint as
  // soon as its own response lands instead of waiting for the slowest sibling.
  useEffect(() => {
    if (!myUserId) {
      setInitialUpcoming('idle');
      setInitialPending('idle');
      return;
    }

    let cancelled = false;

    const fetchOne = async (
      key: 'upcoming' | 'pending',
      state: ReservationState,
      setStatus: (s: ListLoadState) => void
    ) => {
      try {
        const res = await fetchReservations({ userId: myUserId, state });
        if (cancelled) return;
        updateData((prev) => {
          const base = prev ?? EMPTY_DATA;
          return {
            ...base,
            [key]: res.items,
            nextTokens: { ...base.nextTokens, [key]: res.next_dtend },
          };
        });
      } catch (err) {
        captureFlowFailure({
          flow: 'reservation_fetch',
          step: `fetch_${key}`,
          message:
            err instanceof Error
              ? err.message
              : `Failed to fetch reservation ${key}`,
        });
        console.error(`[useReservationData] fetch ${key} error:`, err);
      } finally {
        if (!cancelled) setStatus('ready');
      }
    };

    void fetchOne('upcoming', states.upcoming, setInitialUpcoming);
    void fetchOne('pending', states.pending, setInitialPending);

    return () => {
      cancelled = true;
    };
  }, [myUserId, states.upcoming, states.pending, updateData]);

  const removeItem = useCallback(
    (id: string) => {
      updateData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          upcoming: prev.upcoming.filter((it) => it.id !== id),
          pending: prev.pending.filter((it) => it.id !== id),
          history: prev.history.filter((it) => it.id !== id),
        };
      });
    },
    [updateData]
  );

  // Refetch only the affected states. States belonging to the other role are
  // dropped (mentee page never refetches mentor data) and HISTORY is skipped
  // when not yet loaded — loadHistory will fetch it fresh on tab open instead.
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
        if (state === states.history && !isHistoryLoaded) return false;
        return true;
      });
      if (filtered.length === 0) return;

      try {
        const results = await Promise.all(
          filtered.map((state) =>
            fetchReservations({ userId: myUserId, state })
          )
        );

        updateData((prev) => {
          if (!prev) return prev;
          const next: ReservationData = {
            upcoming: prev.upcoming,
            pending: prev.pending,
            history: prev.history,
            nextTokens: { ...prev.nextTokens },
          };
          filtered.forEach((state, idx) => {
            const key = STATE_TO_LIST_KEY[state];
            next[key] = results[idx].items;
            next.nextTokens[key] = results[idx].next_dtend;
          });
          return next;
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
    [
      myUserId,
      states.upcoming,
      states.pending,
      states.history,
      isHistoryLoaded,
      updateData,
    ]
  );

  const onMutationSuccess = useCallback(
    (id: string, affectedStates: ReservationState[]) => {
      removeItem(id);
      void refetchStates(affectedStates);
    },
    [removeItem, refetchStates]
  );

  const loadHistory = useCallback(async () => {
    if (!myUserId || isHistoryLoaded || isLoadingHistory) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetchReservations({
        userId: myUserId,
        state: states.history,
      });
      updateData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          history: res.items,
          nextTokens: { ...prev.nextTokens, history: res.next_dtend },
        };
      });
      setIsHistoryLoaded(true);
      trackEvent({
        name: 'reservation_history_loaded',
        feature: 'reservation',
      });
    } catch (err) {
      captureFlowFailure({
        flow: 'reservation_load_history',
        step: 'fetch_history',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to load reservation history',
      });
      console.error('[useReservationData] loadHistory error:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [myUserId, states.history, isHistoryLoaded, isLoadingHistory, updateData]);

  const loadMore = useCallback(
    async (state: ReservationState): Promise<void> => {
      if (!myUserId) return;
      const currentData = dataRef.current;
      if (!currentData) return;
      const key = STATE_TO_LIST_KEY[state];
      const cursor = currentData.nextTokens[key];
      if (cursor === 0) return;

      setLoadingMoreStates((prev) => ({ ...prev, [state]: true }));
      try {
        const result = await fetchReservations({
          userId: myUserId,
          state,
          nextDtend: cursor,
        });

        updateData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [key]: [...prev[key], ...result.items],
            nextTokens: {
              ...prev.nextTokens,
              [key]: result.next_dtend,
            },
          };
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
        setLoadingMoreStates((prev) => ({ ...prev, [state]: false }));
      }
    },
    [myUserId, updateData]
  );

  const historyState: ListLoadState = isHistoryLoaded
    ? 'ready'
    : isLoadingHistory
      ? 'loading'
      : 'idle';

  const initialState: InitialListState = {
    upcoming: initialUpcoming,
    pending: initialPending,
    history: historyState,
  };

  // Derived for backward compatibility — true while either initial list is
  // still in flight. UI no longer uses this to gate full-page rendering;
  // per-list `initialState` is the source of truth for skeletons.
  const isLoading =
    initialUpcoming === 'loading' || initialPending === 'loading';

  return {
    data,
    initialState,
    isLoading,
    loadingMoreStates,
    isLoadingHistory,
    isHistoryLoaded,
    myUserId,
    loadMore,
    loadHistory,
    onMutationSuccess,
  };
}
