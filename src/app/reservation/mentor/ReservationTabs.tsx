'use client';

import { ReservationList } from '@/components/reservation/ReservationList';
import type { Reservation } from '@/components/reservation/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { NextTokens } from '@/hooks/user/reservation/useReservationData';
import type { ReservationState } from '@/services/reservations';

export type ReservationTabsProps = {
  upcomingMentee: Reservation[];
  pendingMentee: Reservation[];
  upcomingMentor: Reservation[];
  pendingMentor: Reservation[];
  history: Reservation[];
  nextTokens: NextTokens;
  isLoadingMore: boolean;
  onLoadMore: (state: ReservationState) => void;
  onMutationSuccess?: (id: string) => void;
};

export default function ReservationTabs({
  upcomingMentee,
  pendingMentee,
  upcomingMentor,
  pendingMentor,
  history,
  nextTokens,
  isLoadingMore,
  onLoadMore,
  onMutationSuccess,
}: ReservationTabsProps) {
  void upcomingMentee;
  void pendingMentee;

  const triggerClass =
    'group shrink-0 rounded-full border border-border px-3 py-1.5 text-sm ' +
    'bg-transparent text-foreground ' +
    'data-[state=active]:bg-[#000] data-[state=active]:text-[#fff] data-[state=active]:border-black';

  const countClass =
    'ml-1 text-xs text-muted-foreground group-data-[state=active]:text-white/80';

  return (
    <div className="mx-auto w-full max-w-3xl px-0 sm:px-4 lg:px-6">
      {/* IMPORTANT: defaultValue must match an existing TabsTrigger value */}
      <Tabs defaultValue="upcoming-mentor" className="w-full">
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
                  <TabsTrigger value="upcoming-mentor" className={triggerClass}>
                    即將到來
                    <span className={countClass}>{upcomingMentor.length}</span>
                  </TabsTrigger>

                  <TabsTrigger value="pending-mentor" className={triggerClass}>
                    待您回復
                    <span className={countClass}>{pendingMentor.length}</span>
                  </TabsTrigger>

                  <TabsTrigger value="history" className={triggerClass}>
                    歷史紀錄
                    <span className={countClass}>{history.length}</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 pt-2 sm:px-0">
          <TabsContent value="upcoming-mentor" className="mt-4 sm:mt-6">
            <ReservationList
              items={upcomingMentor}
              variant="upcoming"
              sourceRole="mentor"
              hasMore={nextTokens.mentorUpcoming !== 0}
              onLoadMore={() => onLoadMore('MENTOR_UPCOMING')}
              isLoadingMore={isLoadingMore}
              onMutationSuccess={onMutationSuccess}
            />
          </TabsContent>

          <TabsContent value="pending-mentor" className="mt-4 sm:mt-6">
            <ReservationList
              items={pendingMentor}
              variant="pending-mentor"
              sourceRole="mentor"
              hasMore={nextTokens.mentorPending !== 0}
              onLoadMore={() => onLoadMore('MENTOR_PENDING')}
              isLoadingMore={isLoadingMore}
              onMutationSuccess={onMutationSuccess}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4 sm:mt-6">
            <ReservationList
              items={history}
              variant="history"
              sourceRole="mentor"
              hasMore={nextTokens.history !== 0}
              onLoadMore={() => onLoadMore('HISTORY')}
              isLoadingMore={isLoadingMore}
              onMutationSuccess={onMutationSuccess}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
