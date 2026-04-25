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

  return { data, isLoading, isLoadingMore, loadMore };
}
