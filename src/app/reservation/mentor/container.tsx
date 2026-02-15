'use client';

import dynamic from 'next/dynamic';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { fetchAllReservationLists } from '@/services/reservations/index';

import type { ReservationPresentationProps } from './ui';

const ReservationPresentation = dynamic(() => import('./ui'));

export default function ReservationContainer() {
  const [loginUserId, setLoginUserId] = useState('');
  const [data, setData] = useState<ReservationPresentationProps | null>(null);
  const [loading, setLoading] = useState(true);

  // 先拿到 session 裡的使用者 id
  useEffect(() => {
    const fetchSession = async () => {
      const session = await getSession();
      const user = session?.user;

      if (user?.id) {
        setLoginUserId(String(user.id));
        console.log(user.id);
      }
    };
    fetchSession();
  }, []);

  // 當 loginUserId 有值時，去抓 reservations
  useEffect(() => {
    if (!loginUserId) return; // 還沒拿到使用者 id，不要打 API

    let mounted = true;
    (async () => {
      try {
        const lists = await fetchAllReservationLists({
          userId: loginUserId,
          debug: true,
        });

        if (mounted) {
          setData({
            upcomingMentee: lists.upcomingMentee,
            pendingMentee: lists.pendingMentee,
            upcomingMentor: lists.upcomingMentor,
            pendingMentor: lists.pendingMentor,
            history: lists.history,
          });
        }
      } catch (err) {
        console.error('[ReservationContainer] fetch error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loginUserId]);

  if (loading || !data) return <div className="p-6">Loading…</div>;
  return <ReservationPresentation {...data} />;
}
