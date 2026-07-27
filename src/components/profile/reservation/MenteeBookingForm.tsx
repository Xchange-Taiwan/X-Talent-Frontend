'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BookingSlot } from '@/hooks/useMentorSchedule';
import { useBookingForm } from '@/hooks/user/reservation/useBookingForm';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';

import { BOOKED_SLOT_CLASSES, ScheduleSlotList } from './ScheduleSlotList';

interface MenteeBookingFormProps {
  slots: BookingSlot[];
  monthLoaded: boolean;
  selectedSlot: BookingSlot | null;
  setSelectedSlot: (slot: BookingSlot | null) => void;
  isSubmitting: boolean;
  userData: UserType | null;
  selectedDate: string | null;
  onConfirmReservation: (question: string) => Promise<boolean>;
}

export function MenteeBookingForm({
  slots,
  monthLoaded,
  selectedSlot,
  setSelectedSlot,
  isSubmitting,
  userData,
  selectedDate,
  onConfirmReservation,
}: MenteeBookingFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid, errors },
  } = useBookingForm();

  const onSubmit = async (data: { bookingQuestion: string }) => {
    const success = await onConfirmReservation(data.bookingQuestion);
    if (success) {
      reset();
    }
  };

  const isButtonDisabled =
    isSubmitting || !userData || !selectedDate || !selectedSlot || !isValid;

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
          return (
            <Button
              key={slot.start.getTime()}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              disabled={slot.isBooked}
              onClick={() => setSelectedSlot(slot)}
              className={`h-10 w-full text-sm ${
                slot.isBooked ? BOOKED_SLOT_CLASSES : ''
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
          className="h-[156px] w-full rounded-lg border-background-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
          disabled={isSubmitting}
          {...register('bookingQuestion')}
        />
        {errors.bookingQuestion && (
          <p className="mt-1 text-sm text-status-200">
            {errors.bookingQuestion.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="default"
        className="w-full rounded-full px-6 py-3 disabled:bg-background-top-active disabled:text-text-disable disabled:opacity-100"
        disabled={isButtonDisabled}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            處理中...
          </>
        ) : (
          '預約時間'
        )}
      </Button>
    </form>
  );
}
