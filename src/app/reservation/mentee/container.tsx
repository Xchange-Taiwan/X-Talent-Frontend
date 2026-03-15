'use client';

import dynamic from 'next/dynamic';

import { useReservationData } from '@/hooks/user/reservation/useReservationData';

import { ReservationSkeleton } from '../skeleton';

const ReservationPresentation = dynamic(() => import('./ui'));

export default function ReservationContainer() {
  const { data, isLoading } = useReservationData();

  if (isLoading || !data) return <ReservationSkeleton />;
  return <ReservationPresentation {...data} />;
}
