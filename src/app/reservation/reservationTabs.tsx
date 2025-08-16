'use client';

import { ReservationList } from '@/components/reservation/reservationList';
import type { Reservation } from '@/components/reservation/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ---------- Demo data (replace with API results) ----------
const upcomingMentee: Reservation[] = [
  {
    id: '1',
    name: 'Zahra Mirzakhani',
    roleLine: '7 years Experience, Senior UX Designer',
    date: 'Thu, Feb 01, 2024',
    time: '8:00 pm',
  },
  {
    id: '2',
    name: 'Sakura Tanaka',
    roleLine: '2 years Experience, Junior Research Scientist',
    date: 'Thu, Feb 01, 2024',
    time: '8:00 pm',
  },
  {
    id: '3',
    name: 'Chen Wei',
    roleLine: '5 years Experience, Senior Software Engineer',
    date: 'Thu, Feb 01, 2024',
    time: '8:00 pm',
  },
  {
    id: '4',
    name: 'Lee Ho-man',
    roleLine: '6 years Experience, Financial Analyst',
    date: 'Thu, Feb 01, 2024',
    time: '8:00 pm',
  },
];

const pendingMentee: Reservation[] = [
  {
    id: '5',
    name: 'Aisha Khan',
    roleLine: 'Product Designer, 3 years Experience',
    date: 'Fri, Feb 02, 2024',
    time: '7:30 pm',
  },
  {
    id: '6',
    name: 'Marco Rossi',
    roleLine: 'Front-end Developer, 4 years Experience',
    date: 'Sat, Feb 03, 2024',
    time: '10:00 am',
  },
];

const upcomingMentor: Reservation[] = [
  {
    id: '7',
    name: 'Ivy Chen',
    roleLine: 'Mentee – Portfolio Review',
    date: 'Sun, Feb 04, 2024',
    time: '1:00 pm',
  },
  {
    id: '8',
    name: 'Diego Perez',
    roleLine: 'Mentee – iOS Career Chat',
    date: 'Mon, Feb 05, 2024',
    time: '9:00 am',
  },
  {
    id: '9',
    name: 'Nina Park',
    roleLine: 'Mentee – System Design Prep',
    date: 'Tue, Feb 06, 2024',
    time: '3:00 pm',
  },
  {
    id: '10',
    name: 'Tom Becker',
    roleLine: 'Mentee – Resume Review',
    date: 'Wed, Feb 07, 2024',
    time: '6:00 pm',
  },
];

const pendingMentor: Reservation[] = [
  {
    id: '11',
    name: 'Yuuki Sato',
    roleLine: 'Request – Mock Interview',
    date: 'Thu, Feb 08, 2024',
    time: '8:00 pm',
  },
];

export default function ReservationTabs() {
  return (
    <div className="mx-auto w-full max-w-3xl px-0 sm:px-4 lg:px-6">
      <Tabs defaultValue="upcoming-mentee" className="w-full">
        {/* Top filter tabs */}
        <div className="bg-white sticky top-0 z-10 pb-2">
          {/* 讓 tabs 可以吃到左右邊界（可保留/移除皆可） */}
          <div className="-mx-3 sm:mx-0">
            {/* ✅ 外層：真正的可捲動容器 */}
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
          gap-2
          px-0
        "
              >
                <TabsTrigger
                  value="upcoming-mentee"
                  className="data-[state=active]:bg-black data-[state=active]:text-white shrink-0 rounded-full border border-border px-3 py-1.5 text-sm first:ml-5 last:mr-3"
                >
                  即將到來（學生）
                  <span className="ml-1 text-xs text-muted-foreground">4</span>
                </TabsTrigger>

                <TabsTrigger
                  value="pending-mentee"
                  className="data-[state=active]:bg-black data-[state=active]:text-white shrink-0 rounded-full border border-border px-3 py-1.5 text-sm first:ml-0 last:mr-3"
                >
                  待確認（學生）
                  <span className="ml-1 text-xs text-muted-foreground">2</span>
                </TabsTrigger>

                <TabsTrigger
                  value="upcoming-mentor"
                  className="data-[state=active]:bg-black data-[state=active]:text-white shrink-0 rounded-full border border-border px-3 py-1.5 text-sm first:ml-0 last:mr-3"
                >
                  即將到來（導師）
                  <span className="ml-1 text-xs text-muted-foreground">4</span>
                </TabsTrigger>

                <TabsTrigger
                  value="pending-mentor"
                  className="data-[state=active]:bg-black data-[state=active]:text-white shrink-0 rounded-full border border-border px-3 py-1.5 text-sm first:ml-0 last:mr-3"
                >
                  待確認（導師）
                  <span className="ml-1 text-xs text-muted-foreground">1</span>
                </TabsTrigger>

                <TabsTrigger
                  value="history"
                  className="data-[state=active]:bg-black data-[state=active]:text-white shrink-0 rounded-full border border-border px-3 py-1.5 text-sm first:ml-0 last:mr-3"
                >
                  歷史紀錄
                  <span className="ml-1 text-xs text-muted-foreground">0</span>
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
            <ReservationList items={[]} variant="history" />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
