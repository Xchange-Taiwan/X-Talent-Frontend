'use client';

import { Button } from '@/components/ui/button';
import type { BookingSlot } from '@/hooks/useMentorSchedule';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';

import { BOOKED_SLOT_CLASSES, ScheduleSlotList } from './ScheduleSlotList';

interface MentorScheduleConfigProps {
  slots: BookingSlot[];
  monthLoaded: boolean;
  onReservation: () => void;
}

export function MentorScheduleConfig({
  slots,
  monthLoaded,
  onReservation,
}: MentorScheduleConfigProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <ScheduleSlotList
        slots={slots}
        monthLoaded={monthLoaded}
        renderSlot={(slot) => (
          <div
            className={`flex h-10 items-center justify-center rounded-lg border text-sm font-medium select-none ${
              slot.isBooked ? BOOKED_SLOT_CLASSES : 'border-background-border'
            }`}
          >
            {formatBookingSlotTime(slot)}
            {slot.isBooked && slot.menteeName
              ? ` (已預約: ${slot.menteeName})`
              : ''}
          </div>
        )}
      />

      <Button
        variant="default"
        className="w-full rounded-full px-6 py-3 disabled:bg-background-border disabled:text-text-disable disabled:opacity-100"
        onClick={onReservation}
      >
        預約設定
      </Button>
    </div>
  );
}
