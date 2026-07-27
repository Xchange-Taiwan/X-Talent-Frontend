'use client';

import type { BookingSlot } from '@/hooks/useMentorSchedule';
import type { UserType } from '@/hooks/user/user-data/useUserData';

import { MenteeBookingForm } from './MenteeBookingForm';
import { MentorScheduleConfig } from './MentorScheduleConfig';

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
  // Prevent view flash: if userData is loading/unresolved, render a loading skeleton
  if (!userData) {
    return (
      <div
        className="flex w-full max-w-[335px] animate-pulse flex-col gap-4 md:max-w-[695px] 2xl:max-w-[414px]"
        data-testid="booking-form-skeleton"
      >
        <div className="flex flex-col gap-2">
          <div className="h-4 w-28 rounded bg-gray-200" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 rounded-lg bg-gray-200" />
            <div className="h-10 rounded-lg bg-gray-200" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="h-40 rounded-lg bg-gray-200" />
        </div>
        <div className="h-12 w-full rounded-full bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[335px] flex-col gap-4 md:max-w-[695px] 2xl:max-w-[414px]">
      {isOwnMentorProfile ? (
        <MentorScheduleConfig
          slots={slots}
          monthLoaded={monthLoaded}
          userData={userData}
          onReservation={onReservation}
        />
      ) : (
        <MenteeBookingForm
          slots={slots}
          monthLoaded={monthLoaded}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          isSubmitting={isSubmitting}
          userData={userData}
          selectedDate={selectedDate}
          onConfirmReservation={onConfirmReservation}
        />
      )}
    </div>
  );
}
