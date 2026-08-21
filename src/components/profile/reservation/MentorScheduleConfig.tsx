'use client';

import { Button } from '@/components/ui/button';
import type { BookingSlot } from '@/hooks/useMentorSchedule';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';

interface MentorScheduleConfigProps {
  slots: BookingSlot[];
  monthLoaded: boolean;
  onReservation: () => void;
  onBookedSlotClick: () => void;
}

const LoadingIndicator = () => (
  <div
    aria-busy="true"
    aria-live="polite"
    className="flex min-h-10 items-center text-sm text-text-disable"
  >
    讀取中…
  </div>
);

export function MentorScheduleConfig({
  slots,
  monthLoaded,
  onReservation,
  onBookedSlotClick,
}: MentorScheduleConfigProps) {
  const bookedSlots = slots.filter(
    (slot) =>
      slot.status === 'BOOKED' || slot.status === 'PENDING' || slot.isBooked
  );
  const availableSlots = slots.filter(
    (slot) =>
      slot.status !== 'BOOKED' && slot.status !== 'PENDING' && !slot.isBooked
  );

  return (
    <div className="flex w-full flex-col gap-6">
      {/* 1. 已預約區塊 */}
      <div className="flex w-full flex-col items-start gap-3">
        <p className="text-sm font-semibold text-text-primary">已預約</p>
        {!monthLoaded ? (
          <LoadingIndicator />
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
                onClick={onBookedSlotClick}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-text-primary">
                    {formatBookingSlotTime(slot)}
                  </span>
                  <span className="text-xs font-normal text-text-secondary">
                    {slot.menteeName ? `學員 ${slot.menteeName}` : '學員'}
                  </span>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    slot.status === 'PENDING'
                      ? 'text-status-warning-default'
                      : 'text-status-success-default'
                  }`}
                >
                  {slot.status === 'PENDING' ? '待您回復' : '已確認'}
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
          <LoadingIndicator />
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
