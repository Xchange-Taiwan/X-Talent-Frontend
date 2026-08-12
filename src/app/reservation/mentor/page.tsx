import { Suspense } from 'react';

import { ReservationDashboard } from '@/components/reservation/ReservationDashboard';

export default function Page() {
  return (
    <Suspense>
      <ReservationDashboard userRole="mentor" />
    </Suspense>
  );
}
