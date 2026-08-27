'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useMemo, useState } from 'react';

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

/**
 * Which tabs a mutation affects, split into a mandatory `source` (the tab
 * the item currently lives in - the only one eligible for the immediate
 * local optimistic hide) and `destinations` (tabs the item is moving into,
 * or is otherwise affected for refetch purposes, but has not visibly
 * appeared in yet). Modeled as named fields rather than a plain `ListKey[]`
 * with an implicit "index 0 is the source" convention, so a caller
 * constructing one can't accidentally swap the order and have TypeScript
 * miss it.
 */
export interface MutationAffectedTabs {
  source: ListKey;
  destinations: ListKey[];
}

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
  onMutationSuccess: (
    id: string,
    affected: MutationAffectedTabs | null
  ) => void;
  /**
   * Refetch the affected tabs without removing the item first — for a failed
   * mutation (e.g. a 409 version conflict) where the item is still present
   * but its data (including `version`) is now stale, unlike
   * `onMutationSuccess` which assumes the item moved out of the tab.
   */
  refetchOnConflict: (affected: MutationAffectedTabs | null) => void;
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
  const { data: session } = useSession();
  const myUserId = session?.user?.id ? String(session.user.id) : '';
  const states = ROLE_STATES[role];

  const [loadingMoreStates, setLoadingMoreStates] =
    useState<LoadingMoreStates>(EMPTY_LOADING_MORE);
  const [historyActive, setHistoryActive] = useState(false);
  const [removedIds, setRemovedIds] = useState<Record<ListKey, Set<string>>>(
    () => ({
      upcoming: new Set(),
      pending: new Set(),
      history: new Set(),
    })
  );

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

  const upcomingSorted = useMemo(() => {
    const sorted = upcomingResult ? sortByDtstartAsc(upcomingResult.items) : [];
    return sorted.filter((it) => !removedIds.upcoming.has(it.id));
  }, [upcomingResult, removedIds.upcoming]);

  const pendingSorted = useMemo(() => {
    const sorted = pendingResult ? sortByDtstartAsc(pendingResult.items) : [];
    return sorted.filter((it) => !removedIds.pending.has(it.id));
  }, [pendingResult, removedIds.pending]);

  const historyItems = useMemo(() => {
    const items = historyResult ? historyResult.items : [];
    return items.filter((it) => !removedIds.history.has(it.id));
  }, [historyResult, removedIds.history]);

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

      // Clear cache for skipped target states to prevent stale cache under cross-mount cycles
      targets.forEach((state) => {
        if (ownStates.has(state) && !filtered.includes(state)) {
          const key = toReservationReadKey(myUserId, state);
          if (key) {
            reservationReadModel.invalidate(key);
          }
        }
      });

      if (filtered.length === 0) return;

      try {
        const results = await Promise.all(
          filtered.map((state) =>
            fetchReservations({ userId: myUserId, state })
          )
        );

        filtered.forEach((state, idx) => {
          const key = toReservationReadKey(myUserId, state)!;
          reservationReadModel.update(key, () => results[idx]);
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
    // Only the source tab (the one the item currently lives in) has
    // anything to optimistically hide. Hiding a destination tab too would
    // hide the item there forever once it legitimately shows up, since
    // removedIds only ever grows. Cache freshness itself (getting the item
    // out of the source's cached page and into the destination's) is owned
    // by the write path (acceptReservation / rejectOrCancelReservation, see
    // invalidateReservationRead) instead of being refetched by hand here -
    // X-Tracker #651.
    (id: string, affected: MutationAffectedTabs | null) => {
      if (!affected) return;
      const { source } = affected;
      setRemovedIds((prev) => ({
        ...prev,
        [source]: new Set(prev[source]).add(id),
      }));
    },
    []
  );

  const refetchOnConflict = useCallback(
    (affected: MutationAffectedTabs | null) => {
      if (!affected) return;
      const affectedStates = [affected.source, ...affected.destinations].map(
        (tab) => states[tab]
      );
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
    loadMore,
    loadHistory,
    onMutationSuccess,
    refetchOnConflict,
  };
}
