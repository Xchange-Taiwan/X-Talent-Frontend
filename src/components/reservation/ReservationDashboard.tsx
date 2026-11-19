'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { ReservationListSkeleton } from '@/app/reservation/skeleton';
import { ReservationList } from '@/components/reservation/ReservationList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFeedbackDeepLinkParam } from '@/hooks/user/reservation/useFeedbackDeepLinkParam';
import { useFeedbackQueueParam } from '@/hooks/user/reservation/useFeedbackQueueParam';
import {
  type ReservationRole,
  useReservationDashboard,
  type UseReservationDashboardReturn,
} from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import {
  buildReservationTabSwitchHref,
  type ReservationTabParam,
} from '@/lib/reservation/reservationRoutes';

export interface ReservationDashboardProps {
  userRole: ReservationRole;
  /** Optional pre-built state for deterministic Storybook stories without live NextAuth / API calls. */
  initialDashboard?: UseReservationDashboardReturn;
}

const VALID_TAB_VALUES = new Set<ReservationTabParam>([
  'pending',
  'upcoming',
  'history',
]);

function isReservationTabParam(value: string): value is ReservationTabParam {
  return VALID_TAB_VALUES.has(value as ReservationTabParam);
}

export function ReservationDashboard({
  userRole,
  initialDashboard,
}: ReservationDashboardProps) {
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
      {initialDashboard ? (
        <ReservationDashboardPanel
          userRole={userRole}
          dashboard={initialDashboard}
        />
      ) : (
        <ReservationDashboardConnected userRole={userRole} />
      )}
    </Suspense>
  );
}

function ReservationDashboardConnected({
  userRole,
}: {
  userRole: ReservationRole;
}) {
  const dashboard = useReservationDashboard({ role: userRole });
  return (
    <ReservationDashboardPanel userRole={userRole} dashboard={dashboard} />
  );
}

function ReservationDashboardPanel({
  userRole,
  dashboard,
}: {
  userRole: ReservationRole;
  dashboard: UseReservationDashboardReturn;
}) {
  const { activeTab, myUserId, tabs, loadHistory } = dashboard;
  const isMentee = userRole === 'mentee';
  const normalizedUserId = myUserId || undefined;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const {
    hasDeepLinkTarget,
    deepLinkDialogReservation,
    highlightedReservationId,
    autoExpandedReservationId,
    deepLinkTriggerSeq,
    dismissDeepLinkDialog,
    clearDeepLinkFocus,
  } = useFeedbackDeepLinkParam({
    userRole,
    myUserId: normalizedUserId,
    history: tabs.history.items,
    isHistoryLoaded: tabs.history.isLoaded,
    isLoadingHistory: tabs.history.isFetching,
    isLoadingMoreHistory: tabs.history.isLoadingMore,
    hasMoreHistory: tabs.history.hasMore,
    onLoadMoreHistory: tabs.history.loadMore,
  });

  const { feedbackQueueItems, skipFeedbackQueueItem, dismissFeedbackQueue } =
    useFeedbackQueueParam({
      role: userRole,
      isMentee,
      userId: normalizedUserId,
      history: tabs.history.items,
      isHistoryLoaded: tabs.history.isLoaded,
      isLoadingHistory: tabs.history.isFetching,
      isLoadingUpcoming: tabs.upcoming.isInitialLoading,
      isLoadingPending: tabs.pending.isInitialLoading,
    });

  const triggerClass =
    'group shrink-0 rounded-full border border-background-border px-3 py-1.5 text-sm ' +
    'bg-transparent text-text-primary ' +
    'data-[state=active]:bg-dark data-[state=active]:text-text-white data-[state=active]:border-dark';

  const countClass =
    'ml-1 text-xs text-text-tertiary group-data-[state=active]:text-text-white/80';

  const handleValueChange = (value: string) => {
    const nextTab: ReservationTabParam = isReservationTabParam(value)
      ? value
      : 'pending';

    trackEvent({
      name: 'reservation_tab_changed',
      feature: 'reservation',
      metadata: {
        role: userRole,
        tab: nextTab,
      },
    });
    if (nextTab !== 'history') {
      clearDeepLinkFocus();
    } else if (!tabs.history.isLoaded && !tabs.history.isFetching) {
      void loadHistory();
    }

    const nextHref = buildReservationTabSwitchHref(
      pathname,
      searchParams.toString(),
      nextTab
    );
    router.replace(nextHref, { scroll: false });
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
                      <TabsTrigger value="pending" className={triggerClass}>
                        {pendingLabel}
                        <span className={countClass}>
                          {tabs.pending.badgeCount}
                        </span>
                      </TabsTrigger>

                      <TabsTrigger value="upcoming" className={triggerClass}>
                        即將到來
                        <span className={countClass}>
                          {tabs.upcoming.badgeCount}
                        </span>
                      </TabsTrigger>

                      <TabsTrigger value="history" className={triggerClass}>
                        歷史紀錄
                        {tabs.history.showBadge ? (
                          <span className={countClass}>
                            {tabs.history.badgeCount}
                          </span>
                        ) : null}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-3 pt-2 sm:px-0">
              <TabsContent value="pending" className="mt-4 sm:mt-6">
                {tabs.pending.isInitialLoading ? (
                  <ReservationListSkeleton />
                ) : (
                  <ReservationList
                    items={tabs.pending.items}
                    variant={pendingVariant}
                    sourceRole={userRole}
                    myUserId={normalizedUserId}
                    hasMore={tabs.pending.hasMore}
                    onLoadMore={tabs.pending.loadMore}
                    isLoadingMore={tabs.pending.isLoadingMore}
                  />
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="mt-4 sm:mt-6">
                {tabs.upcoming.isInitialLoading ? (
                  <ReservationListSkeleton />
                ) : (
                  <ReservationList
                    items={tabs.upcoming.items}
                    variant="upcoming"
                    sourceRole={userRole}
                    myUserId={normalizedUserId}
                    hasMore={tabs.upcoming.hasMore}
                    onLoadMore={tabs.upcoming.loadMore}
                    isLoadingMore={tabs.upcoming.isLoadingMore}
                  />
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4 sm:mt-6">
                {tabs.history.isInitialLoading ? (
                  <ReservationListSkeleton />
                ) : (
                  <ReservationList
                    items={tabs.history.items}
                    variant="history"
                    sourceRole={userRole}
                    myUserId={normalizedUserId}
                    hasMore={tabs.history.hasMore}
                    onLoadMore={tabs.history.loadMore}
                    isLoadingMore={tabs.history.isLoadingMore}
                    feedbackQueueItems={
                      hasDeepLinkTarget || deepLinkDialogReservation
                        ? null
                        : feedbackQueueItems
                    }
                    onFeedbackQueueClose={dismissFeedbackQueue}
                    onSkipFeedbackQueueItem={skipFeedbackQueueItem}
                    deepLinkDialogReservation={deepLinkDialogReservation}
                    onDeepLinkDialogClose={dismissDeepLinkDialog}
                    highlightedReservationId={highlightedReservationId}
                    autoExpandedReservationId={autoExpandedReservationId}
                    deepLinkTriggerSeq={deepLinkTriggerSeq}
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
