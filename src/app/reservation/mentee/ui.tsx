'use client';

import ReservationTabs, { type ReservationTabsProps } from './ReservationTabs';

export type ReservationPresentationProps = ReservationTabsProps;

export default function ReservationPresentation(
  props: ReservationPresentationProps
) {
  return (
    <div className="flex min-h-[calc(100vh-70px)] justify-center">
      <div className="w-full max-w-[90%] overflow-hidden rounded-2xl md:max-w-[800px]">
        <div className="font-roboto mx-auto mb-6 h-[42px] w-[251px] text-center text-[36px] font-semibold leading-[100%] tracking-[0%] text-[#1D1B20]">
          預約導師
        </div>
        <ReservationTabs {...props} />
      </div>
    </div>
  );
}
