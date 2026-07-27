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
  if (isOwnMentorProfile) {
    return (
      <MentorScheduleConfig
        slots={slots}
        monthLoaded={monthLoaded}
        userData={userData}
        onReservation={onReservation}
      />
    );
  }

  return (
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
  );
}
