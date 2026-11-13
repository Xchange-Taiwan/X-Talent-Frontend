'use client';

import { Suspense } from 'react';

import { ReservationListSkeleton } from '@/app/reservation/skeleton';
import { useReservationHistoryRedirect } from '@/hooks/user/reservation/useReservationHistoryRedirect';

function ReservationHistoryLoadingShell() {
  return (
    <div className="flex min-h-[calc(100vh-70px)] justify-center pb-12">
      <div className="w-full max-w-[90%] rounded-2xl md:max-w-[800px]">
        <ReservationListSkeleton />
      </div>
    </div>
  );
}

function ReservationHistoryRedirector() {
  useReservationHistoryRedirect();
  return <ReservationHistoryLoadingShell />;
}

export default function ReservationHistoryPage() {
  return (
    <Suspense fallback={<ReservationHistoryLoadingShell />}>
      <ReservationHistoryRedirector />
    </Suspense>
  );
}
