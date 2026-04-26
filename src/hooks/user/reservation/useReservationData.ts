import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import { Reservation } from '@/components/reservation/types';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  fetchAllReservationLists,
  fetchReservations,
  ReservationState,
} from '@/services/reservations';

export interface NextTokens {
  menteeUpcoming: number;
  menteePending: number;
  mentorUpcoming: number;
  mentorPending: number;
  history: number;
}

export interface ReservationData {
  upcomingMentee: Reservation[];
  pendingMentee: Reservation[];
  upcomingMentor: Reservation[];
  pendingMentor: Reservation[];
  history: Reservation[];
  nextTokens: NextTokens;
}

const STATE_TO_TOKEN_KEY: Record<ReservationState, keyof NextTokens> = {
  MENTEE_UPCOMING: 'menteeUpcoming',
  MENTEE_PENDING: 'menteePending',
  MENTOR_UPCOMING: 'mentorUpcoming',
  MENTOR_PENDING: 'mentorPending',
  HISTORY: 'history',
};

const STATE_TO_DATA_KEY: Record<
  ReservationState,
  keyof Omit<ReservationData, 'nextTokens'>
> = {
  MENTEE_UPCOMING: 'upcomingMentee',
  MENTEE_PENDING: 'pendingMentee',
  MENTOR_UPCOMING: 'upcomingMentor',
  MENTOR_PENDING: 'pendingMentor',
  HISTORY: 'history',
};

const ALL_STATES: ReservationState[] = [
  'MENTEE_UPCOMING',
  'MENTEE_PENDING',
  'MENTOR_UPCOMING',
  'MENTOR_PENDING',
  'HISTORY',
];

export function useReservationData() {
  const { data: session } = useSession();
  const loginUserId = session?.user?.id ? String(session.user.id) : '';

  const [data, setData] = useState<ReservationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (!loginUserId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const lists = await fetchAllReservationLists({ userId: loginUserId });

        if (cancelled) return;

        setData({
          upcomingMentee: lists.upcomingMentee,
          pendingMentee: lists.pendingMentee,
          upcomingMentor: lists.upcomingMentor,
          pendingMentor: lists.pendingMentor,
          history: lists.history,
          nextTokens: {
            menteeUpcoming: lists.nextTokens.menteeUpcoming,
            menteePending: lists.nextTokens.menteePending,
            mentorUpcoming: lists.nextTokens.mentorUpcoming,
            mentorPending: lists.nextTokens.mentorPending,
            history: lists.nextTokens.history,
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
  }, [loginUserId]);

  // Optimistic helper: drop the operated item from every list so the user
  // doesn't see it lingering while the background refetch runs.
  const removeItem = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        upcomingMentee: prev.upcomingMentee.filter((it) => it.id !== id),
        pendingMentee: prev.pendingMentee.filter((it) => it.id !== id),
        upcomingMentor: prev.upcomingMentor.filter((it) => it.id !== id),
        pendingMentor: prev.pendingMentor.filter((it) => it.id !== id),
        history: prev.history.filter((it) => it.id !== id),
      };
    });
  }, []);

  // Refetch every state in parallel, asking the backend for at least as many
  // rows as are currently displayed so previously load-more'd items don't
  // disappear after a mutation.
  const refetchAll = useCallback(async () => {
    if (!loginUserId) return;
    try {
      const results = await Promise.all(
        ALL_STATES.map((state) => {
          const dataKey = STATE_TO_DATA_KEY[state];
          const currentCount = (data?.[dataKey] as Reservation[] | undefined)
            ?.length;
          return fetchReservations({
            userId: loginUserId,
            state,
            batch: Math.max(currentCount ?? 10, 10),
          });
        })
      );

      setData((prev) => {
        if (!prev) return prev;
        const next: ReservationData = {
          ...prev,
          nextTokens: { ...prev.nextTokens },
        };
        ALL_STATES.forEach((state, idx) => {
          const dataKey = STATE_TO_DATA_KEY[state];
          const tokenKey = STATE_TO_TOKEN_KEY[state];
          (next as unknown as Record<string, Reservation[]>)[dataKey] =
            results[idx].items;
          next.nextTokens[tokenKey] = results[idx].next_dtend;
        });
        return next;
      });
    } catch (err) {
      captureFlowFailure({
        flow: 'reservation_refetch',
        step: 'fetch_all',
        message:
          err instanceof Error ? err.message : 'Failed to refetch reservations',
      });
      console.error('[useReservationData] refetch error:', err);
    }
  }, [loginUserId, data]);

  // Single entry point used by mutation handlers in ReservationList: optimistic
  // remove first (so the card disappears immediately), then refetch in the
  // background to pick up the moved item in its destination state.
  const onMutationSuccess = useCallback(
    (id: string) => {
      removeItem(id);
      void refetchAll();
    },
    [removeItem, refetchAll]
  );

  const loadMore = useCallback(
    async (state: ReservationState): Promise<void> => {
      if (!data || !loginUserId) return;

      const tokenKey = STATE_TO_TOKEN_KEY[state];
      const cursor = data.nextTokens[tokenKey];
      if (cursor === 0) return;

      setIsLoadingMore(true);
      try {
        const result = await fetchReservations({
          userId: loginUserId,
          state,
          nextDtend: cursor,
        });

        setData((prev) => {
          if (!prev) return prev;
          const dataKey = STATE_TO_DATA_KEY[state];
          return {
            ...prev,
            [dataKey]: [...(prev[dataKey] as Reservation[]), ...result.items],
            nextTokens: {
              ...prev.nextTokens,
              [tokenKey]: result.next_dtend,
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
    [data, loginUserId]
  );

  return {
    data,
    isLoading,
    isLoadingMore,
    loadMore,
    onMutationSuccess,
  };
}
