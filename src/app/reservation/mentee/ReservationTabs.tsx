'use client';

import { ReservationList } from '@/components/reservation/ReservationList';
import type { Reservation } from '@/components/reservation/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { NextTokens } from '@/hooks/user/reservation/useReservationData';
import type { ReservationState } from '@/services/reservations';

import { ReservationListSkeleton } from '../skeleton';

export type ReservationTabsProps = {
  upcoming: Reservation[];
  pending: Reservation[];
  history: Reservation[];
  nextTokens: NextTokens;
  isLoadingMore: boolean;
  isLoadingHistory: boolean;
  isHistoryLoaded: boolean;
  myUserId: string;
  onLoadMore: (state: ReservationState) => void;
  onLoadHistory: () => void;
  onMutationSuccess?: (id: string, affectedStates: ReservationState[]) => void;
};

export default function ReservationTabs({
  upcoming,
  pending,
  history,
  nextTokens,
  isLoadingMore,
  isLoadingHistory,
  isHistoryLoaded,
  myUserId,
  onLoadMore,
  onLoadHistory,
  onMutationSuccess,
}: ReservationTabsProps) {
  const triggerClass =
    'group shrink-0 rounded-full border border-border px-3 py-1.5 text-sm ' +
    'bg-transparent text-foreground ' +
    'data-[state=active]:bg-[#000] data-[state=active]:text-[#fff] data-[state=active]:border-black';

  const countClass =
    'ml-1 text-xs text-muted-foreground group-data-[state=active]:text-white/80';

  const handleValueChange = (value: string) => {
    if (value === 'history' && !isHistoryLoaded && !isLoadingHistory) {
      onLoadHistory();
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-0 sm:px-4 lg:px-6">
      {/* IMPORTANT: defaultValue must match an existing TabsTrigger value */}
      <Tabs
        defaultValue="upcoming-mentee"
        className="w-full"
        onValueChange={handleValueChange}
      >
        <div className="bg-white sticky top-0 z-10 pb-2">
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
                <TabsList className="bg-transparent inline-flex w-max items-center gap-2 px-0">
                  <TabsTrigger value="upcoming-mentee" className={triggerClass}>
                    即將到來
                    <span className={countClass}>{upcoming.length}</span>
                  </TabsTrigger>

                  <TabsTrigger value="pending-mentee" className={triggerClass}>
                    等待回復
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
          <TabsContent value="upcoming-mentee" className="mt-4 sm:mt-6">
            <ReservationList
              items={upcoming}
              variant="upcoming"
              sourceRole="mentee"
              myUserId={myUserId}
              hasMore={nextTokens.upcoming !== 0}
              onLoadMore={() => onLoadMore('MENTEE_UPCOMING')}
              isLoadingMore={isLoadingMore}
              onMutationSuccess={onMutationSuccess}
            />
          </TabsContent>

          <TabsContent value="pending-mentee" className="mt-4 sm:mt-6">
            <ReservationList
              items={pending}
              variant="pending-mentee"
              sourceRole="mentee"
              myUserId={myUserId}
              hasMore={nextTokens.pending !== 0}
              onLoadMore={() => onLoadMore('MENTEE_PENDING')}
              isLoadingMore={isLoadingMore}
              onMutationSuccess={onMutationSuccess}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4 sm:mt-6">
            {isLoadingHistory && !isHistoryLoaded ? (
              <ReservationListSkeleton />
            ) : (
              <ReservationList
                items={history}
                variant="history"
                sourceRole="mentee"
                myUserId={myUserId}
                hasMore={nextTokens.history !== 0}
                onLoadMore={() => onLoadMore('MENTEE_HISTORY')}
                isLoadingMore={isLoadingMore}
                onMutationSuccess={onMutationSuccess}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
