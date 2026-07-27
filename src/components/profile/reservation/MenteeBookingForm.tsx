'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BookingSlot } from '@/hooks/useMentorSchedule';
import { useBookingForm } from '@/hooks/user/reservation/useBookingForm';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';

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
  const { register, handleSubmit, watch, setValue } = useBookingForm();
  const bookingQuestion = watch('bookingQuestion') || '';

  const onSubmit = async (data: { bookingQuestion: string }) => {
    const success = await onConfirmReservation(data.bookingQuestion);
    if (success) {
      setValue('bookingQuestion', '');
    }
  };

  const isButtonDisabled =
    isSubmitting ||
    !userData ||
    !selectedDate ||
    !selectedSlot ||
    !bookingQuestion.trim();

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full max-w-[335px] flex-col gap-4 md:max-w-[695px] 2xl:max-w-[414px]"
    >
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
            {slots.map((slot) => {
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
                    slot.isBooked
                      ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 disabled:opacity-100'
                      : ''
                  }`}
                >
                  {formatBookingSlotTime(slot)}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-2">
        <label htmlFor="booking-question" className="text-sm font-semibold">
          你想問導師的問題
        </label>
        <Textarea
          id="booking-question"
          placeholder="請在此輸入你的問題..."
          className="h-[156px] w-full max-w-[335px] rounded-lg border-[#E6E8EA] focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 md:max-w-[695px] 2xl:max-w-[404px]"
          disabled={isSubmitting}
          {...register('bookingQuestion')}
        />
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
