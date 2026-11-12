'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import { trackEvent } from '@/lib/analytics';
import { isAbortError } from '@/lib/errorUtils';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  type ReservationReadKey,
  reservationReadModel,
} from '@/lib/reservation/reservationReadModel';
import { fetchReservations, ReservationState } from '@/services/reservations';
import { Reservation } from '@/types/reservation';

export type ReservationRole = 'mentee' | 'mentor';

interface NextTokens {
  upcoming: number;
  pending: number;
  history: number;
}

interface ReservationData {
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

type ListLoadState = 'idle' | 'loading' | 'ready';

type InitialListState = Record<ListKey, ListLoadState>;

type LoadingMoreStates = Record<ListKey, boolean>;

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

export interface UseReservationDataReturn {
  data: ReservationData | null;
  initialState: InitialListState;
  isLoading: boolean;
  loadingMoreStates: LoadingMoreStates;
  isLoadingHistory: boolean;
  isHistoryLoaded: boolean;
  myUserId: string;
  isMentor?: boolean;
  isSessionLoading?: boolean;
  loadMore: (tab: ListKey) => Promise<void>;
  loadHistory: () => Promise<void>;
}

function toReservationReadKey(
  userId: string | number | null | undefined,
  state: ReservationState
): ReservationReadKey | null {
  return userId ? { userId: String(userId), state } : null;
}

export function useReservationData({
  role,
}: {
  role: ReservationRole;
}): UseReservationDataReturn {
  const { data: session, status } = useSession();
  const lastUserIdRef = useRef('');
  const currentSessionUserId = session?.user?.id ? String(session.user.id) : '';
  if (currentSessionUserId) {
    lastUserIdRef.current = currentSessionUserId;
  } else if (status === 'unauthenticated') {
    lastUserIdRef.current = '';
  }
  const myUserId = currentSessionUserId || lastUserIdRef.current;
  const states = ROLE_STATES[role];

  const [loadingMoreStates, setLoadingMoreStates] =
    useState<LoadingMoreStates>(EMPTY_LOADING_MORE);
  const [historyActive, setHistoryActive] = useState(false);

  // useAsyncRead compares keys by reference to detect a "key changed" edge
  // during render, so these must stay referentially stable across renders
  // when (userId, state) hasn't actually changed - hence useMemo rather than
  // a fresh object literal per render.
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
      historyActive ? toReservationReadKey(myUserId, states.history) : null,
    [historyActive, myUserId, states.history]
  );

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
    reservationReadModel,
    upcomingKey,
    fetchUpcoming
  );

  const { data: pendingResult, isLoading: isPendingLoading } = useAsyncRead(
    reservationReadModel,
    pendingKey,
    fetchPending
  );

  const { data: historyResult, isLoading: isHistoryLoading } = useAsyncRead(
    reservationReadModel,
    historyKey,
    fetchHistory
  );

  const isHistoryLoaded = historyResult !== null && !isHistoryLoading;

  const upcomingSorted = useMemo<Reservation[]>(() => {
    return upcomingResult ? sortByDtstartAsc(upcomingResult.items) : [];
  }, [upcomingResult]);

  const pendingSorted = useMemo<Reservation[]>(() => {
    const sorted = pendingResult ? sortByDtstartAsc(pendingResult.items) : [];
    return sorted.filter((it) => !it.cancelledBy);
  }, [pendingResult]);

  const historyItems = useMemo<Reservation[]>(() => {
    const derivedCancelledFromPending = (pendingResult?.items ?? []).filter(
      (it) => Boolean(it.cancelledBy)
    );
    const items = historyResult ? historyResult.items : [];
    const existingIds = new Set(items.map((it) => it.id));
    return [
      ...derivedCancelledFromPending.filter((it) => !existingIds.has(it.id)),
      ...items,
    ];
  }, [pendingResult, historyResult]);

  const data = useMemo<ReservationData | null>(() => {
    if (!myUserId) return null;
    if (!upcomingResult && !pendingResult && !historyResult) return null;

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
      const key = toReservationReadKey(myUserId, states[tab])!;
      const currentData = reservationReadModel.get(key);
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

        reservationReadModel.update(key, (current) => {
          const base = current ?? currentData;
          return {
            items: [...base.items, ...result.items],
            next_dtend: result.next_dtend,
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
    isMentor: Boolean(session?.user?.isMentor),
    isSessionLoading: status === 'loading' && !myUserId,
    loadMore,
    loadHistory,
  };
}
