'use client';

import { Button } from '@/components/ui/button';
import type { BookingSlot } from '@/hooks/useMentorSchedule';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';

import { BOOKED_SLOT_CLASSES, ScheduleSlotList } from './ScheduleSlotList';

interface MentorScheduleConfigProps {
  slots: BookingSlot[];
  monthLoaded: boolean;
  onReservation: () => void;
  isOwnMentorProfile?: boolean;
}

export function MentorScheduleConfig({
  slots,
  monthLoaded,
  onReservation,
  isOwnMentorProfile = true,
}: MentorScheduleConfigProps) {
  // If isOwnMentorProfile is false (regression check / fallback), keep original behavior exactly
  if (!isOwnMentorProfile) {
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

  const bookedSlots = slots.filter((slot) => slot.isBooked);
  const availableSlots = slots.filter((slot) => !slot.isBooked);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* 1. 已預約區塊 */}
      <div className="flex w-full flex-col items-start gap-3">
        <p className="text-sm font-semibold text-text-primary">已預約</p>
        {!monthLoaded ? (
          <div
            aria-busy="true"
            aria-live="polite"
            className="flex min-h-10 items-center text-sm text-text-disable"
          >
            讀取中…
          </div>
        ) : bookedSlots.length === 0 ? (
          <div className="flex min-h-10 items-center text-sm text-text-disable">
            目前無已預約時段
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {bookedSlots.map((slot) => (
              <button
                key={`${slot.scheduleId}_${slot.start.getTime()}`}
                type="button"
                className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-background-border px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-background-bottom/50"
                onClick={onReservation}
              >
                <span className="text-text-primary">
                  {formatBookingSlotTime(slot)}
                </span>
                <span className="text-xs font-normal text-text-secondary">
                  已預約 (暫定)
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. 可預約時段區塊 */}
      <div className="flex w-full flex-col items-start gap-3">
        <p className="text-sm font-semibold text-text-primary">
          當日可預約時段
        </p>
        {!monthLoaded ? (
          <div
            aria-busy="true"
            aria-live="polite"
            className="flex min-h-10 items-center text-sm text-text-disable"
          >
            讀取中…
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="flex min-h-10 items-center text-sm text-text-disable">
            無可預約的時段
          </div>
        ) : (
          <div className="grid w-full grid-cols-2 gap-2">
            {availableSlots.map((slot) => (
              <div
                key={`${slot.scheduleId}_${slot.start.getTime()}`}
                className="flex h-10 items-center justify-center rounded-lg border border-background-border text-sm font-medium select-none"
              >
                {formatBookingSlotTime(slot)}
              </div>
            ))}
          </div>
        )}
      </div>

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
