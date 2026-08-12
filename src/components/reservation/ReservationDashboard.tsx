'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect } from 'react';

import { ReservationListSkeleton } from '@/app/reservation/skeleton';
import { ReservationList } from '@/components/reservation/ReservationList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type ListKey,
  type ReservationRole,
  useReservationData,
} from '@/hooks/user/reservation/useReservationData';
import type { Reservation } from '@/types/reservation';

export interface ReservationDashboardProps {
  userRole: ReservationRole;
}

export function ReservationDashboard({ userRole }: ReservationDashboardProps) {
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
  } = useReservationData({ role: userRole });

  const upcoming = data?.upcoming ?? [];
  const pending = data?.pending ?? [];
  const history = data?.history ?? [];
  const nextTokens = data?.nextTokens ?? {
    upcoming: 0,
    pending: 0,
    history: 0,
  };

  const loadMoreUpcoming = useCallback(() => loadMore('upcoming'), [loadMore]);
  const loadMorePending = useCallback(() => loadMore('pending'), [loadMore]);
  const loadMoreHistory = useCallback(() => loadMore('history'), [loadMore]);

  const isLoadingUpcoming = initialState.upcoming === 'loading';
  const isLoadingPending = initialState.pending === 'loading';

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-70px)] justify-center pb-12">
          <div className="w-full max-w-[90%] rounded-2xl md:max-w-[800px]">
            <ReservationListSkeleton />
          </div>
        </div>
      }
    >
      <ReservationDashboardView
        userRole={userRole}
        myUserId={myUserId}
        upcoming={upcoming}
        pending={pending}
        history={history}
        isLoadingUpcoming={isLoadingUpcoming}
        isLoadingPending={isLoadingPending}
        isLoadingHistory={isLoadingHistory}
        isHistoryLoaded={isHistoryLoaded}
        nextTokens={nextTokens}
        loadingMoreStates={loadingMoreStates}
        onLoadMoreUpcoming={loadMoreUpcoming}
        onLoadMorePending={loadMorePending}
        onLoadMoreHistory={loadMoreHistory}
        onLoadHistory={loadHistory}
        onMutationSuccess={onMutationSuccess}
      />
    </Suspense>
  );
}

export interface ReservationDashboardViewProps {
  userRole: ReservationRole;
  myUserId: string | undefined;
  upcoming: Reservation[];
  pending: Reservation[];
  history: Reservation[];
  isLoadingUpcoming: boolean;
  isLoadingPending: boolean;
  isLoadingHistory: boolean;
  isHistoryLoaded: boolean;
  nextTokens: {
    upcoming: number;
    pending: number;
    history: number;
  };
  loadingMoreStates: {
    upcoming: boolean;
    pending: boolean;
    history: boolean;
  };
  onLoadMoreUpcoming: () => void;
  onLoadMorePending: () => void;
  onLoadMoreHistory: () => void;
  onLoadHistory: () => void;
  onMutationSuccess?: (id: string, affectedTabs: ListKey[]) => void;
}

export function ReservationDashboardView({
  userRole,
  myUserId,
  upcoming,
  pending,
  history,
  isLoadingUpcoming,
  isLoadingPending,
  isLoadingHistory,
  isHistoryLoaded,
  nextTokens,
  loadingMoreStates,
  onLoadMoreUpcoming,
  onLoadMorePending,
  onLoadMoreHistory,
  onLoadHistory,
  onMutationSuccess,
}: ReservationDashboardViewProps) {
  const isMentee = userRole === 'mentee';
  const upcomingTabValue = isMentee ? 'upcoming-mentee' : 'upcoming-mentor';
  const pendingTabValue = isMentee ? 'pending-mentee' : 'pending-mentor';

  const TAB_MAPPING: Record<string, string> = {
    upcoming: upcomingTabValue,
    pending: pendingTabValue,
    history: 'history',
  };

  const URL_PARAM_MAPPING: Record<string, string> = {
    [upcomingTabValue]: 'upcoming',
    [pendingTabValue]: 'pending',
    history: 'history',
  };

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get('tab');
  const activeTab = (tabParam && TAB_MAPPING[tabParam]) || upcomingTabValue;

  // Load history automatically if activeTab starts as history and is not loaded
  useEffect(() => {
    if (activeTab === 'history' && !isHistoryLoaded && !isLoadingHistory) {
      onLoadHistory();
    }
  }, [activeTab, isHistoryLoaded, isLoadingHistory, onLoadHistory]);

  const triggerClass =
    'group shrink-0 rounded-full border border-background-border px-3 py-1.5 text-sm ' +
    'bg-transparent text-text-primary ' +
    'data-[state=active]:bg-dark data-[state=active]:text-text-white data-[state=active]:border-dark';

  const countClass =
    'ml-1 text-xs text-text-tertiary group-data-[state=active]:text-text-white/80';

  const handleValueChange = (value: string) => {
    if (value === 'history' && !isHistoryLoaded && !isLoadingHistory) {
      onLoadHistory();
    }

    const params = new URLSearchParams(searchParams.toString());
    const paramValue = URL_PARAM_MAPPING[value];
    if (paramValue) {
      params.set('tab', paramValue);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const title = isMentee ? '預約導師' : '擔任導師';
  const pendingLabel = isMentee ? '等待回復' : '待您回復';
  const pendingVariant = isMentee ? 'pending-mentee' : 'pending-mentor';

  return (
    <div className="flex min-h-[calc(100vh-70px)] justify-center pb-12">
      <div className="w-full max-w-[90%] rounded-2xl md:max-w-[800px]">
        <div className="mx-auto mb-6 text-center font-sans text-2xl leading-tight font-semibold tracking-normal text-text-primary md:text-36 md:leading-tight">
          {title}
        </div>

        <div className="mx-auto w-full max-w-3xl px-0 sm:px-4 lg:px-6">
          <Tabs
            value={activeTab}
            className="w-full"
            onValueChange={handleValueChange}
          >
            <div className="sticky top-0 z-10 bg-background-white pb-2">
              <div className="-mx-3 sm:mx-0">
                <div
                  className="mb-3 [touch-action:pan-x] snap-none [scrollbar-width:none] overflow-x-auto px-0 py-1 whitespace-nowrap [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] sm:snap-x sm:snap-proximity [&::-webkit-scrollbar]:hidden"
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
                    sourceRole={userRole}
                    myUserId={myUserId}
                    hasMore={nextTokens.upcoming !== 0}
                    onLoadMore={onLoadMoreUpcoming}
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
                    sourceRole={userRole}
                    myUserId={myUserId}
                    hasMore={nextTokens.pending !== 0}
                    onLoadMore={onLoadMorePending}
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
                    sourceRole={userRole}
                    myUserId={myUserId}
                    hasMore={nextTokens.history !== 0}
                    onLoadMore={onLoadMoreHistory}
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
