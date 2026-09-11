'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useBookingForm } from '@/hooks/user/reservation/useBookingForm';
import type { BookingSlot } from '@/lib/profile/bookingAvailability';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';
import { isSlotTaken } from '@/lib/profile/scheduleHelpers';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import type { BookingFormValues } from '@/schemas/bookingSchema';

import { BOOKED_SLOT_CLASSES, ScheduleSlotList } from './ScheduleSlotList';

interface MenteeBookingFormProps {
  slots: BookingSlot[];
  monthLoaded: boolean;
  selectedSlot: BookingSlot | null;
  setSelectedSlot: (slot: BookingSlot | null) => void;
  isSubmitting: boolean;
  selectedDate: string | null;
  onConfirmReservation: (question?: string) => Promise<boolean>;
  isAuthenticated: boolean;
  /** True once the currently browsed month has resolved to zero bookable dates. */
  hasNoAvailabilityThisMonth?: boolean;
}

export function MenteeBookingForm({
  slots,
  monthLoaded,
  selectedSlot,
  setSelectedSlot,
  isSubmitting,
  selectedDate,
  onConfirmReservation,
  isAuthenticated,
  hasNoAvailabilityThisMonth = false,
}: MenteeBookingFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useBookingForm();

  const onSubmit = async (data: BookingFormValues) => {
    const success = await onConfirmReservation(data.bookingQuestion);
    if (success) {
      reset();
    }
  };

  const isButtonDisabled =
    isSubmitting ||
    !isAuthenticated ||
    !selectedDate ||
    !selectedSlot ||
    isSlotTaken(selectedSlot) ||
    Object.keys(errors).length > 0;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full flex-col gap-4"
    >
      {hasNoAvailabilityThisMonth ? (
        // Text-only, no CTA: the calendar above this form is still fully
        // navigable, so a mentor who opens up again in a later month is one
        // page-flip away - a "browse other mentors" button here would just
        // steer people away from someone they could still book.
        <Card className="w-full border-dashed">
          <CardContent className="p-6 text-center">
            <p className="text-text-secondary text-sm">
              這位導師本月尚未開放預約時段，可切換月份查看其他時間
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScheduleSlotList
          slots={slots}
          monthLoaded={monthLoaded}
          renderSlot={(slot) => {
            const isSelected =
              selectedSlot?.start.getTime() === slot.start.getTime();
            const taken = isSlotTaken(slot);
            return (
              <Button
                key={`${slot.scheduleId}_${slot.start.getTime()}`}
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                disabled={taken}
                onClick={() => setSelectedSlot(slot)}
                className={`h-10 w-full text-sm ${
                  taken ? BOOKED_SLOT_CLASSES : ''
                }`}
              >
                {formatBookingSlotTime(slot)}
              </Button>
            );
          }}
        />
      )}

      <div className="flex w-full flex-col gap-2">
        <label htmlFor="booking-question" className="text-sm font-semibold">
          你想問導師的問題
        </label>
        <Textarea
          id="booking-question"
          placeholder="請在此輸入你的問題..."
          className={cn(
            'border-background-border h-[156px] w-full rounded-lg',
            FOCUS_RING_NO_OFFSET_CLASSES
          )}
          // Gated on having an actual slot picked, not just on this month
          // being empty: a slot two months out disables it exactly the same
          // way, with no separate "which month" logic to keep in sync.
          disabled={isSubmitting || !selectedSlot}
          {...register('bookingQuestion')}
        />
        {errors.bookingQuestion && (
          <p className="text-status-error-default mt-1 text-sm">
            {errors.bookingQuestion.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="default"
        className="disabled:bg-background-border disabled:text-text-disable w-full rounded-full px-6 py-3 disabled:opacity-100"
        disabled={isButtonDisabled}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            處理中...
          </>
        ) : (
          '預約時間'
        )}
      </Button>
    </form>
  );
}
