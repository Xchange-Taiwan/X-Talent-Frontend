'use client';

import React from 'react';

import type { BookingSlot } from '@/hooks/useMentorSchedule';

interface ScheduleSlotListProps {
  slots: BookingSlot[];
  monthLoaded: boolean;
  renderSlot: (slot: BookingSlot) => React.ReactNode;
}

export function ScheduleSlotList({
  slots,
  monthLoaded,
  renderSlot,
}: ScheduleSlotListProps) {
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <p>當日可預約時段</p>
      {!monthLoaded ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="flex min-h-10 items-center text-gray-400"
        >
          讀取中…
        </div>
      ) : slots.length === 0 ? (
        <div className="flex min-h-10 items-center text-gray-400">
          無可預約的時段
        </div>
      ) : (
        <div className="grid w-full grid-cols-2 gap-2">
          {slots.map((slot) => (
            <React.Fragment key={slot.start.getTime()}>
              {renderSlot(slot)}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
