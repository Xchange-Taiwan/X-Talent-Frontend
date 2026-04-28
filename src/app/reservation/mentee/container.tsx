'use client';

import { useReservationData } from '@/hooks/user/reservation/useReservationData';

import ReservationPresentation from './ui';

export default function ReservationContainer() {
  const {
    data,
    initialState,
    loadingMoreStates,
    isLoadingHistory,
    isHistoryLoaded,
    myUserId,
    loadMore,
    loadHistory,
    onMutationSuccess,
  } = useReservationData({ role: 'mentee' });

  return (
    <ReservationPresentation
      upcoming={data?.upcoming ?? []}
      pending={data?.pending ?? []}
      history={data?.history ?? []}
      nextTokens={data?.nextTokens ?? { upcoming: 0, pending: 0, history: 0 }}
      initialState={initialState}
      loadingMoreStates={loadingMoreStates}
      isLoadingHistory={isLoadingHistory}
      isHistoryLoaded={isHistoryLoaded}
      myUserId={myUserId}
      onLoadMore={loadMore}
      onLoadHistory={loadHistory}
      onMutationSuccess={onMutationSuccess}
    />
  );
}
