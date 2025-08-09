'use client';

import dynamic from 'next/dynamic';
const ReservationPresentation = dynamic(() => import('./ui'));

export default function ReservationContainer() {
  return <ReservationPresentation />;
}
