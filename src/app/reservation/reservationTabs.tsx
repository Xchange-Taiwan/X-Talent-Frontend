'use client';

import { ReservationList } from '@/components/reservation/reservationList';
import type { Reservation } from '@/components/reservation/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type ReservationTabsProps = {
  upcomingMentee: Reservation[];
  pendingMentee: Reservation[];
  upcomingMentor: Reservation[];
  pendingMentor: Reservation[];
  history: Reservation[];
};

export default function ReservationTabs({
  upcomingMentee,
  pendingMentee,
  upcomingMentor,
  pendingMentor,
  history,
}: ReservationTabsProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-0 sm:px-4 lg:px-6">
      <Tabs defaultValue="upcoming-mentee" className="w-full">
        {/* Top filter tabs */}
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
              <TabsList
                className="
                  bg-transparent inline-flex w-max items-center
                  gap-2 px-0
                "
              >
                <TabsTrigger
                  value="upcoming-mentee"
                  className="data-[state=active]:bg-black data-[state=active]:text-white shrink-0 rounded-full border border-border px-3 py-1.5 text-sm first:ml-5 last:mr-3"
                >
                  即將到來（學生）
                  <span className="ml-1 text-xs text-muted-foreground">
                    {upcomingMentee.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="pending-mentee"
                  className="data-[state=active]:bg-black data-[state=active]:text-white shrink-0 rounded-full border border-border px-3 py-1.5 text-sm first:ml-0 last:mr-3"
                >
                  待確認（學生）
                  <span className="ml-1 text-xs text-muted-foreground">
                    {pendingMentee.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="upcoming-mentor"
                  className="data-[state=active]:bg-black data-[state=active]:text-white shrink-0 rounded-full border border-border px-3 py-1.5 text-sm first:ml-0 last:mr-3"
                >
                  即將到來（導師）
                  <span className="ml-1 text-xs text-muted-foreground">
                    {upcomingMentor.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="pending-mentor"
                  className="data-[state=active]:bg-black data-[state=active]:text-white shrink-0 rounded-full border border-border px-3 py-1.5 text-sm first:ml-0 last:mr-3"
                >
                  待確認（導師）
                  <span className="ml-1 text-xs text-muted-foreground">
                    {pendingMentor.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="history"
                  className="data-[state=active]:bg-black data-[state=active]:text-white shrink-0 rounded-full border border-border px-3 py-1.5 text-sm first:ml-0 last:mr-3"
                >
                  歷史紀錄
                  <span className="ml-1 text-xs text-muted-foreground">
                    {history.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-3 pt-2 sm:px-0">
          <TabsContent value="upcoming-mentee" className="mt-4 sm:mt-6">
            <ReservationList items={upcomingMentee} variant="upcoming" />
          </TabsContent>
          <TabsContent value="pending-mentee" className="mt-4 sm:mt-6">
            <ReservationList items={pendingMentee} variant="pending-mentee" />
          </TabsContent>
          <TabsContent value="upcoming-mentor" className="mt-4 sm:mt-6">
            <ReservationList items={upcomingMentor} variant="upcoming" />
          </TabsContent>
          <TabsContent value="pending-mentor" className="mt-4 sm:mt-6">
            <ReservationList items={pendingMentor} variant="pending-mentor" />
          </TabsContent>
          <TabsContent value="history" className="mt-4 sm:mt-6">
            <ReservationList items={history} variant="history" />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
