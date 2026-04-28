'use client';

import dynamic from 'next/dynamic';

import { useReservationData } from '@/hooks/user/reservation/useReservationData';

import { ReservationSkeleton } from '../skeleton';

const ReservationPresentation = dynamic(() => import('./ui'));

export default function ReservationContainer() {
  const {
    data,
    isLoading,
    isLoadingMore,
    isLoadingHistory,
    isHistoryLoaded,
    myUserId,
    loadMore,
    loadHistory,
    onMutationSuccess,
  } = useReservationData({ role: 'mentee' });

  if (isLoading || !data) return <ReservationSkeleton />;
  return (
    <ReservationPresentation
      {...data}
      isLoadingMore={isLoadingMore}
      isLoadingHistory={isLoadingHistory}
      isHistoryLoaded={isHistoryLoaded}
      myUserId={myUserId}
      onLoadMore={loadMore}
      onLoadHistory={loadHistory}
      onMutationSuccess={onMutationSuccess}
    />
  );
}
