'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BookingSlot } from '@/hooks/useMentorSchedule';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';

interface BookingFormProps {
  isOwnMentorProfile: boolean;
  slots: BookingSlot[];
  monthLoaded: boolean;
  selectedSlot: BookingSlot | null;
  setSelectedSlot: (slot: BookingSlot | null) => void;
  isSubmitting: boolean;
  userData: UserType | null;
  selectedDate: string | null;
  onReservation: () => void;
  onConfirmReservation: (question: string) => Promise<boolean>;
}

export function BookingForm({
  isOwnMentorProfile,
  slots,
  monthLoaded,
  selectedSlot,
  setSelectedSlot,
  isSubmitting,
  userData,
  selectedDate,
  onReservation,
  onConfirmReservation,
}: BookingFormProps) {
  const [bookingQuestion, setBookingQuestion] = useState('');

  const handleConfirm = async () => {
    const success = await onConfirmReservation(bookingQuestion);
    if (success) {
      setBookingQuestion('');
    }
  };

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
            {slots.map((slot) => {
              const isSelected =
                selectedSlot?.start.getTime() === slot.start.getTime();
              if (isOwnMentorProfile) {
                return (
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
                );
              }
              return (
                <Button
                  key={slot.start.getTime()}
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

      {!isOwnMentorProfile && (
        <div className="flex w-full flex-col gap-2">
          <label htmlFor="booking-question" className="text-sm font-semibold">
            你想問導師的問題
          </label>
          <Textarea
            id="booking-question"
            placeholder="請在此輸入你的問題..."
            className="h-[156px] w-full max-w-[335px] rounded-lg border-[#E6E8EA] focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 md:max-w-[695px] 2xl:max-w-[404px]"
            value={bookingQuestion}
            onChange={(e) => setBookingQuestion(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      )}

      <Button
        variant="default"
        className="w-full rounded-full px-6 py-3"
        onClick={isOwnMentorProfile ? onReservation : handleConfirm}
        disabled={
          isOwnMentorProfile
            ? !userData
            : isSubmitting ||
              !userData ||
              !selectedDate ||
              !selectedSlot ||
              !bookingQuestion.trim()
        }
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            處理中...
          </>
        ) : isOwnMentorProfile ? (
          '預約設定'
        ) : (
          '預約時間'
        )}
      </Button>
    </div>
  );
}
