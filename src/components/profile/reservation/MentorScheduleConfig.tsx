'use client';

import { Button } from '@/components/ui/button';
import type { BookingSlot } from '@/hooks/useMentorSchedule';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';

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
    <div className="flex w-full max-w-[335px] flex-col gap-4 md:max-w-[695px] 2xl:max-w-[414px]">
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
              <div
                key={slot.start.getTime()}
                className={`flex h-10 select-none items-center justify-center rounded-lg border text-sm font-medium ${
                  slot.isBooked
                    ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                    : 'border-[#E6E8EA]'
                }`}
              >
                {formatBookingSlotTime(slot)}
              </div>
            ))}
          </div>
        )}
      </div>

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
