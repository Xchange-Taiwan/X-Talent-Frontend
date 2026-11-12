'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { ReservationListSkeleton } from '@/app/reservation/skeleton';
import { ReservationList } from '@/components/reservation/ReservationList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type ReservationRole,
  useReservationData,
} from '@/hooks/user/reservation/useReservationData';
import { useTargetReservationFeedback } from '@/hooks/user/reservation/useTargetReservationFeedback';
import type { Reservation } from '@/types/reservation';

const MAX_AUTO_HISTORY_PAGES = 50;

export interface ReservationDashboardProps {
  userRole: ReservationRole;
}

function ReservationDashboardPageSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-70px)] justify-center pb-12">
      <div className="w-full max-w-[90%] rounded-2xl md:max-w-[800px]">
        <ReservationListSkeleton />
      </div>
    </div>
  );
}

function ReservationDashboardContent({
  isMentor,
  isSessionLoading,
  ...props
}: Omit<
  ReservationDashboardViewProps,
  'targetReservationId' | 'autoOpenReservationId' | 'disableAutoLoadHistory'
> & {
  isMentor?: boolean;
  isSessionLoading?: boolean;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const reservationIdParam = searchParams.get('reservation_id');
  const normalizedReservationId = reservationIdParam?.trim() || null;

  const {
    history,
    isHistoryLoaded,
    isLoadingHistory,
    loadingMoreStates,
    myUserId,
    nextTokens,
    onLoadHistory,
    onLoadMoreHistory,
    userRole,
  } = props;

  const hasTargetInHistory = Boolean(
    normalizedReservationId &&
    history.some((item) => item.id === normalizedReservationId)
  );

  const shouldAutoLoadHistory =
    tabParam === 'history' || Boolean(normalizedReservationId);
  const autoLoadScopeKey = shouldAutoLoadHistory
    ? [
        userRole,
        myUserId ?? '',
        tabParam === 'history' ? 'history' : '',
        normalizedReservationId ?? '',
      ].join(':')
    : null;

  const autoLoadTrackerRef = useRef<{
    scopeKey: string | null;
    requested: boolean;
    wasLoading: boolean;
  }>({
    scopeKey: null,
    requested: false,
    wasLoading: false,
  });

  const [failedHistoryScopeKey, setFailedHistoryScopeKey] = useState<
    string | null
  >(null);

  if (autoLoadTrackerRef.current.scopeKey !== autoLoadScopeKey) {
    autoLoadTrackerRef.current = {
      scopeKey: autoLoadScopeKey,
      requested: false,
      wasLoading: false,
    };
  }

  const autoPageScopeKey = normalizedReservationId
    ? `${userRole}:${normalizedReservationId}`
    : null;

  const autoPageTrackerRef = useRef<{
    scopeKey: string | null;
    requestedCursors: Set<number>;
    lastRequestedCursor: number | null;
    wasLoadingMore: boolean;
  }>({
    scopeKey: null,
    requestedCursors: new Set(),
    lastRequestedCursor: null,
    wasLoadingMore: false,
  });

  const [exhaustedCursorKey, setExhaustedCursorKey] = useState<string | null>(
    null
  );

  if (autoPageTrackerRef.current.scopeKey !== autoPageScopeKey) {
    autoPageTrackerRef.current = {
      scopeKey: autoPageScopeKey,
      requestedCursors: new Set(),
      lastRequestedCursor: null,
      wasLoadingMore: false,
    };
  }

  const currentCursorKey =
    autoPageScopeKey && nextTokens.history !== 0
      ? `${autoPageScopeKey}:${nextTokens.history}`
      : null;

  useEffect(() => {
    const tracker = autoPageTrackerRef.current;
    if (loadingMoreStates.history) {
      tracker.wasLoadingMore = true;
      return;
    }
    if (tracker.wasLoadingMore) {
      tracker.wasLoadingMore = false;
      if (
        currentCursorKey &&
        tracker.lastRequestedCursor !== null &&
        nextTokens.history === tracker.lastRequestedCursor
      ) {
        setExhaustedCursorKey(currentCursorKey);
      }
    }
  }, [currentCursorKey, loadingMoreStates.history, nextTokens.history]);

  const hasMoreHistory =
    nextTokens.history !== 0 &&
    exhaustedCursorKey !== currentCursorKey &&
    (loadingMoreStates.history ||
      autoPageTrackerRef.current.requestedCursors.size <
        MAX_AUTO_HISTORY_PAGES);

  useEffect(() => {
    const tracker = autoLoadTrackerRef.current;

    if (!autoLoadScopeKey) {
      if (failedHistoryScopeKey !== null) {
        setFailedHistoryScopeKey(null);
      }
      return;
    }

    if (isHistoryLoaded) {
      tracker.requested = false;
      tracker.wasLoading = false;
      if (failedHistoryScopeKey !== null) {
        setFailedHistoryScopeKey(null);
      }
      return;
    }

    if (isLoadingHistory) {
      tracker.wasLoading = true;
      if (failedHistoryScopeKey !== null) {
        setFailedHistoryScopeKey(null);
      }
      return;
    }

    if (tracker.wasLoading) {
      tracker.wasLoading = false;
      tracker.requested = true;
      setFailedHistoryScopeKey(autoLoadScopeKey);
      return;
    }

    if (shouldAutoLoadHistory && !tracker.requested) {
      tracker.requested = true;
      onLoadHistory();
    }
  }, [
    autoLoadScopeKey,
    failedHistoryScopeKey,
    isHistoryLoaded,
    isLoadingHistory,
    onLoadHistory,
    shouldAutoLoadHistory,
  ]);

  const hasHistoryLoadFailed = Boolean(
    autoLoadScopeKey && failedHistoryScopeKey === autoLoadScopeKey
  );

  useEffect(() => {
    if (
      !normalizedReservationId ||
      !isHistoryLoaded ||
      hasTargetInHistory ||
      loadingMoreStates.history ||
      nextTokens.history === 0
    ) {
      return;
    }

    const tracker = autoPageTrackerRef.current;
    if (
      tracker.requestedCursors.has(nextTokens.history) ||
      tracker.requestedCursors.size >= MAX_AUTO_HISTORY_PAGES
    ) {
      return;
    }

    tracker.requestedCursors.add(nextTokens.history);
    tracker.lastRequestedCursor = nextTokens.history;
    onLoadMoreHistory();
  }, [
    hasTargetInHistory,
    isHistoryLoaded,
    loadingMoreStates.history,
    nextTokens.history,
    normalizedReservationId,
    onLoadMoreHistory,
  ]);

  const {
    historyWithTargetFeedback,
    targetReservationId,
    autoOpenReservationId,
    isResolvingRole,
  } = useTargetReservationFeedback({
    userId: myUserId,
    userRole,
    isMentor,
    isSessionLoading,
    reservationId: reservationIdParam,
    history,
    isHistoryLoaded: isHistoryLoaded || hasHistoryLoadFailed,
    hasMoreHistory: !hasHistoryLoadFailed && hasMoreHistory,
  });

  if (isResolvingRole) {
    return <ReservationDashboardPageSkeleton />;
  }

  return (
    <ReservationDashboardView
      {...props}
      history={historyWithTargetFeedback}
      targetReservationId={targetReservationId}
      autoOpenReservationId={autoOpenReservationId}
      disableAutoLoadHistory
    />
  );
}

export function ReservationDashboard({ userRole }: ReservationDashboardProps) {
  const {
    data,
    initialState,
    loadingMoreStates,
    isLoadingHistory,
    isHistoryLoaded,
    myUserId,
    isMentor,
    isSessionLoading,
    loadMore,
    loadHistory,
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
    <Suspense fallback={<ReservationDashboardPageSkeleton />}>
      <ReservationDashboardContent
        userRole={userRole}
        myUserId={myUserId}
        isMentor={isMentor}
        isSessionLoading={isSessionLoading}
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
  targetReservationId?: string | null;
  autoOpenReservationId?: string | null;
  disableAutoLoadHistory?: boolean;
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
  targetReservationId,
  autoOpenReservationId,
  disableAutoLoadHistory = false,
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
  const reservationIdParam = searchParams.get('reservation_id')?.trim() || null;
  const activeTab =
    (tabParam && TAB_MAPPING[tabParam]) ||
    (reservationIdParam ? 'history' : pendingTabValue);

  const effectiveTargetReservationId =
    targetReservationId !== undefined
      ? targetReservationId
      : reservationIdParam;
  const effectiveAutoOpenReservationId =
    autoOpenReservationId !== undefined
      ? autoOpenReservationId
      : effectiveTargetReservationId &&
          history.some(
            (it) =>
              it.id === effectiveTargetReservationId &&
              !it.cancelledBy &&
              it.feedback?.nextStep === 'ANSWER'
          )
        ? effectiveTargetReservationId
        : null;

  const lastCountsRef = useRef<{
    role: ReservationRole;
    upcoming: number;
    pending: number;
    history: number;
    hasHistoryLoadedOnce: boolean;
  }>({
    role: userRole,
    upcoming: upcoming.length,
    pending: pending.length,
    history: history.length,
    hasHistoryLoadedOnce: isHistoryLoaded,
  });

  if (lastCountsRef.current.role !== userRole) {
    lastCountsRef.current = {
      role: userRole,
      upcoming: upcoming.length,
      pending: pending.length,
      history: history.length,
      hasHistoryLoadedOnce: isHistoryLoaded,
    };
  }

  const isAnyTabLoading =
    isLoadingUpcoming || isLoadingPending || isLoadingHistory;

  if (!isLoadingUpcoming && (upcoming.length > 0 || !isAnyTabLoading)) {
    lastCountsRef.current.upcoming = upcoming.length;
  }
  if (!isLoadingPending && (pending.length > 0 || !isAnyTabLoading)) {
    lastCountsRef.current.pending = pending.length;
  }
  if (isHistoryLoaded && !isLoadingHistory) {
    lastCountsRef.current.history = history.length;
    lastCountsRef.current.hasHistoryLoadedOnce = true;
  }

  const upcomingBadgeCount =
    upcoming.length === 0 && isAnyTabLoading
      ? lastCountsRef.current.upcoming
      : upcoming.length;
  const pendingBadgeCount =
    pending.length === 0 && isAnyTabLoading
      ? lastCountsRef.current.pending
      : pending.length;
  const showHistoryBadge =
    isHistoryLoaded || lastCountsRef.current.hasHistoryLoadedOnce;
  const historyBadgeCount =
    (!isHistoryLoaded || isLoadingHistory) &&
    history.length === 0 &&
    lastCountsRef.current.hasHistoryLoadedOnce
      ? lastCountsRef.current.history
      : history.length;

  // Load history automatically if activeTab starts as history and is not loaded
  useEffect(() => {
    if (
      !disableAutoLoadHistory &&
      activeTab === 'history' &&
      !isHistoryLoaded &&
      !isLoadingHistory
    ) {
      onLoadHistory();
    }
  }, [
    activeTab,
    disableAutoLoadHistory,
    isHistoryLoaded,
    isLoadingHistory,
    onLoadHistory,
  ]);

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
    if (value !== 'history') {
      params.delete('reservation_id');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const title = isMentee ? '預約導師' : '擔任導師';
  const pendingLabel = isMentee ? '等待回覆' : '待您回覆';
  const pendingVariant = isMentee ? 'pending-mentee' : 'pending-mentor';

  return (
    <div className="flex min-h-[calc(100vh-70px)] justify-center pb-12">
      <div className="w-full max-w-[90%] rounded-2xl md:max-w-[800px]">
        <div className="text-text-primary md:text-36 mx-auto mb-6 text-center font-sans text-2xl leading-tight font-semibold tracking-normal md:leading-tight">
          {title}
        </div>

        <div className="mx-auto w-full max-w-3xl px-0 sm:px-4 lg:px-6">
          <Tabs
            value={activeTab}
            className="w-full"
            onValueChange={handleValueChange}
          >
            <div className="bg-background-white sticky top-0 z-10 pb-2">
              <div className="-mx-3 sm:mx-0">
                <div
                  className="mb-3 [touch-action:pan-x] snap-none [scrollbar-width:none] overflow-x-auto px-0 py-1 whitespace-nowrap [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] sm:snap-x sm:snap-proximity [&::-webkit-scrollbar]:hidden"
                  dir="ltr"
                >
                  <div className="flex justify-center">
                    <TabsList className="inline-flex w-max items-center gap-2 bg-transparent px-0">
                      <TabsTrigger
                        value={pendingTabValue}
                        className={triggerClass}
                      >
                        {pendingLabel}
                        <span className={countClass}>{pendingBadgeCount}</span>
                      </TabsTrigger>

                      <TabsTrigger
                        value={upcomingTabValue}
                        className={triggerClass}
                      >
                        即將到來
                        <span className={countClass}>{upcomingBadgeCount}</span>
                      </TabsTrigger>

                      <TabsTrigger value="history" className={triggerClass}>
                        歷史紀錄
                        {showHistoryBadge ? (
                          <span className={countClass}>
                            {historyBadgeCount}
                          </span>
                        ) : null}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-3 pt-2 sm:px-0">
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
                  />
                )}
              </TabsContent>

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
                    targetReservationId={effectiveTargetReservationId}
                    autoOpenReservationId={effectiveAutoOpenReservationId}
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
