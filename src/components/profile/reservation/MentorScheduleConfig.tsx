'use client';

import { Button } from '@/components/ui/button';
import type { BookingSlot } from '@/hooks/useMentorSchedule';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';

import { ScheduleSlotList } from './ScheduleSlotList';

interface MentorScheduleConfigProps {
  slots: BookingSlot[];
  monthLoaded: boolean;
  userData: UserType | null;
  onReservation: () => void;
}

export function MentorScheduleConfig({
  slots,
  monthLoaded,
  userData,
  onReservation,
}: MentorScheduleConfigProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <ScheduleSlotList
        slots={slots}
        monthLoaded={monthLoaded}
        renderSlot={(slot) => (
          <div
            className={`flex h-10 select-none items-center justify-center rounded-lg border text-sm font-medium ${
              slot.isBooked
                ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                : 'border-background-border'
            }`}
          >
            {formatBookingSlotTime(slot)}
          </div>
        )}
      />

      <Button
        variant="default"
        className="w-full rounded-full px-6 py-3 disabled:bg-background-top-active disabled:text-text-disable disabled:opacity-100"
        onClick={onReservation}
        disabled={!userData}
      >
        預約設定
      </Button>
    </div>
  );
}
