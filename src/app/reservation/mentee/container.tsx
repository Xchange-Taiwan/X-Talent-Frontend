'use client';

import dynamic from 'next/dynamic';

import { useReservationData } from '@/hooks/user/reservation/useReservationData';

const ReservationPresentation = dynamic(() => import('./ui'));

export default function ReservationContainer() {
  const { data, isLoading } = useReservationData();

  if (isLoading || !data) return <div className="p-6">Loading…</div>;
  return <ReservationPresentation {...data} />;
}
