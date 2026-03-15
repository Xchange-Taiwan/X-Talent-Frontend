'use client';

import dynamic from 'next/dynamic';

import { PageLoading } from '@/components/ui/loading-spinner';
import { useReservationData } from '@/hooks/user/reservation/useReservationData';

const ReservationPresentation = dynamic(() => import('./ui'));

export default function ReservationContainer() {
  const { data, isLoading } = useReservationData();

  if (isLoading || !data) return <PageLoading />;
  return <ReservationPresentation {...data} />;
}
