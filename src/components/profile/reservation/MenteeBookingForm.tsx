'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBookingForm } from '@/hooks/user/reservation/useBookingForm';
import type { BookingSlot } from '@/lib/profile/bookingAvailability';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';
import { isSlotTaken } from '@/lib/profile/scheduleHelpers';
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

      <div className="flex w-full flex-col gap-2">
        <label htmlFor="booking-question" className="text-sm font-semibold">
          你想問導師的問題
        </label>
        <Textarea
          id="booking-question"
          placeholder="請在此輸入你的問題..."
          className="border-background-border focus-visible:ring-primary h-[156px] w-full rounded-lg focus-visible:ring-1 focus-visible:ring-offset-0"
          disabled={isSubmitting}
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
