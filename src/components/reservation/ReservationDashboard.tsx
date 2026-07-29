'use client';

import { useCallback } from 'react';

import { ReservationListSkeleton } from '@/app/reservation/skeleton';
import { ReservationList } from '@/components/reservation/ReservationList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type ReservationRole,
  useReservationData,
} from '@/hooks/user/reservation/useReservationData';

export interface ReservationDashboardProps {
  role: ReservationRole;
}

export function ReservationDashboard({ role }: ReservationDashboardProps) {
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
  } = useReservationData({ role });

  const upcoming = data?.upcoming ?? [];
  const pending = data?.pending ?? [];
  const history = data?.history ?? [];
  const nextTokens = data?.nextTokens ?? {
    upcoming: 0,
    pending: 0,
    history: 0,
  };

  const isMentee = role === 'mentee';
  const upcomingTabValue = isMentee ? 'upcoming-mentee' : 'upcoming-mentor';
  const pendingTabValue = isMentee ? 'pending-mentee' : 'pending-mentor';

  const loadMoreUpcoming = useCallback(() => loadMore('upcoming'), [loadMore]);
  const loadMorePending = useCallback(() => loadMore('pending'), [loadMore]);
  const loadMoreHistory = useCallback(() => loadMore('history'), [loadMore]);

  const triggerClass =
    'group shrink-0 rounded-full border border-background-border px-3 py-1.5 text-sm ' +
    'bg-transparent text-text-primary ' +
    'data-[state=active]:bg-dark data-[state=active]:text-text-white data-[state=active]:border-dark';

  const countClass =
    'ml-1 text-xs text-text-tertiary group-data-[state=active]:text-text-white/80';

  const handleValueChange = (value: string) => {
    if (value === 'history' && !isHistoryLoaded && !isLoadingHistory) {
      loadHistory();
    }
  };

  const title = isMentee ? '預約導師' : '擔任導師';
  const pendingLabel = isMentee ? '等待回復' : '待您回復';
  const pendingVariant = isMentee ? 'pending-mentee' : 'pending-mentor';

  const isLoadingUpcoming = initialState.upcoming === 'loading';
  const isLoadingPending = initialState.pending === 'loading';

  return (
    <div className="flex min-h-[calc(100vh-70px)] justify-center pb-12">
      <div className="w-full max-w-[90%] rounded-2xl md:max-w-[800px]">
        <div className="mx-auto mb-6 text-center font-sans text-2xl font-semibold leading-tight tracking-normal text-text-primary md:text-36 md:leading-tight">
          {title}
        </div>

        <div className="mx-auto w-full max-w-3xl px-0 sm:px-4 lg:px-6">
          <Tabs
            defaultValue={upcomingTabValue}
            className="w-full"
            onValueChange={handleValueChange}
          >
            <div className="sticky top-0 z-10 bg-background-white pb-2">
              <div className="-mx-3 sm:mx-0">
                <div
                  className="
                    mb-3 snap-none
                    overflow-x-auto whitespace-nowrap px-0
                    py-1 [-ms-overflow-style:none]
                    [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [touch-action:pan-x]
                    sm:snap-x sm:snap-proximity [&::-webkit-scrollbar]:hidden
                  "
                  dir="ltr"
                >
                  <div className="flex justify-center">
                    <TabsList className="inline-flex w-max items-center gap-2 bg-transparent px-0">
                      <TabsTrigger
                        value={upcomingTabValue}
                        className={triggerClass}
                      >
                        即將到來
                        <span className={countClass}>{upcoming.length}</span>
                      </TabsTrigger>

                      <TabsTrigger
                        value={pendingTabValue}
                        className={triggerClass}
                      >
                        {pendingLabel}
                        <span className={countClass}>{pending.length}</span>
                      </TabsTrigger>

                      <TabsTrigger value="history" className={triggerClass}>
                        歷史紀錄
                        {isHistoryLoaded ? (
                          <span className={countClass}>{history.length}</span>
                        ) : null}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-3 pt-2 sm:px-0">
              <TabsContent value={upcomingTabValue} className="mt-4 sm:mt-6">
                {isLoadingUpcoming ? (
                  <ReservationListSkeleton />
                ) : (
                  <ReservationList
                    items={upcoming}
                    variant="upcoming"
                    sourceRole={role}
                    myUserId={myUserId}
                    hasMore={nextTokens.upcoming !== 0}
                    onLoadMore={loadMoreUpcoming}
                    isLoadingMore={loadingMoreStates.upcoming}
                    onMutationSuccess={onMutationSuccess}
                  />
                )}
              </TabsContent>

              <TabsContent value={pendingTabValue} className="mt-4 sm:mt-6">
                {isLoadingPending ? (
                  <ReservationListSkeleton />
                ) : (
                  <ReservationList
                    items={pending}
                    variant={pendingVariant}
                    sourceRole={role}
                    myUserId={myUserId}
                    hasMore={nextTokens.pending !== 0}
                    onLoadMore={loadMorePending}
                    isLoadingMore={loadingMoreStates.pending}
                    onMutationSuccess={onMutationSuccess}
                  />
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4 sm:mt-6">
                {isLoadingHistory && !isHistoryLoaded ? (
                  <ReservationListSkeleton />
                ) : (
                  <ReservationList
                    items={history}
                    variant="history"
                    sourceRole={role}
                    myUserId={myUserId}
                    hasMore={nextTokens.history !== 0}
                    onLoadMore={loadMoreHistory}
                    isLoadingMore={loadingMoreStates.history}
                    onMutationSuccess={onMutationSuccess}
                  />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
