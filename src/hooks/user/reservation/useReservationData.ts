import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

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

export interface UseReservationDataReturn {
  data: ReservationData | null;
  isLoading: boolean;
  isLoadingMore: boolean;
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
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  // Initial fetch covers only the role's UPCOMING + PENDING states. HISTORY is
  // lazy and only fetched when the user opens the history tab via loadHistory.
  useEffect(() => {
    if (!myUserId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [upcomingRes, pendingRes] = await Promise.all([
          fetchReservations({ userId: myUserId, state: states.upcoming }),
          fetchReservations({ userId: myUserId, state: states.pending }),
        ]);

        if (cancelled) return;

        setData({
          upcoming: upcomingRes.items,
          pending: pendingRes.items,
          history: [],
          nextTokens: {
            upcoming: upcomingRes.next_dtend,
            pending: pendingRes.next_dtend,
            history: 0,
          },
        });
      } catch (err) {
        captureFlowFailure({
          flow: 'reservation_fetch',
          step: 'fetch_lists',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to fetch reservation lists',
        });
        console.error('[useReservationData] fetch error:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [myUserId, states.upcoming, states.pending]);

  const removeItem = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        upcoming: prev.upcoming.filter((it) => it.id !== id),
        pending: prev.pending.filter((it) => it.id !== id),
        history: prev.history.filter((it) => it.id !== id),
      };
    });
  }, []);

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

        setData((prev) => {
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
    [myUserId, states.upcoming, states.pending, states.history, isHistoryLoaded]
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
      setData((prev) => {
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
  }, [myUserId, states.history, isHistoryLoaded, isLoadingHistory]);

  const loadMore = useCallback(
    async (state: ReservationState): Promise<void> => {
      if (!data || !myUserId) return;
      const key = STATE_TO_LIST_KEY[state];
      const cursor = data.nextTokens[key];
      if (cursor === 0) return;

      setIsLoadingMore(true);
      try {
        const result = await fetchReservations({
          userId: myUserId,
          state,
          nextDtend: cursor,
        });

        setData((prev) => {
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
        setIsLoadingMore(false);
      }
    },
    [data, myUserId]
  );

  return {
    data,
    isLoading,
    isLoadingMore,
    isLoadingHistory,
    isHistoryLoaded,
    myUserId,
    loadMore,
    loadHistory,
    onMutationSuccess,
  };
}
