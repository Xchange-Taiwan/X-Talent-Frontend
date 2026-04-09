'use client';

import ReservationTabs, { type ReservationTabsProps } from './ReservationTabs';

export type ReservationPresentationProps = ReservationTabsProps;

export default function ReservationPresentation(
  props: ReservationPresentationProps
) {
  return (
    <div className="flex min-h-[calc(100vh-70px)] justify-center pb-12">
      <div className="w-full max-w-[90%] rounded-2xl md:max-w-[800px]">
        <div className="font-roboto mx-auto mb-6 text-center text-2xl font-semibold leading-tight tracking-[0%] text-[#1D1B20] md:text-[36px]">
          擔任導師
        </div>
        <ReservationTabs {...props} />
      </div>
    </div>
  );
}
