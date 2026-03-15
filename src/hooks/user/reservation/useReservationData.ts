import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Reservation } from '@/components/reservation/types';
import { fetchAllReservationLists } from '@/services/reservations';

export type ReservationData = {
  upcomingMentee: Reservation[];
  pendingMentee: Reservation[];
  upcomingMentor: Reservation[];
  pendingMentor: Reservation[];
  history: Reservation[];
};

export function useReservationData() {
  const { data: session } = useSession();
  const loginUserId = session?.user?.id ? String(session.user.id) : '';

  const [data, setData] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loginUserId) return;

    let cancelled = false;

    (async () => {
      try {
        const lists = await fetchAllReservationLists({
          userId: loginUserId,
          debug: true,
        });

        if (cancelled) return;

        setData({
          upcomingMentee: lists.upcomingMentee,
          pendingMentee: lists.pendingMentee,
          upcomingMentor: lists.upcomingMentor,
          pendingMentor: lists.pendingMentor,
          history: lists.history,
        });
      } catch (err) {
        console.error('[useReservationData] fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loginUserId]);

  return { data, loading };
}
