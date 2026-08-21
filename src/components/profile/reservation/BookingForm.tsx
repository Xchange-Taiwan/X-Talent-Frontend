'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { BookingSlot } from '@/hooks/useMentorSchedule';

import { MenteeBookingForm } from './MenteeBookingForm';
import { MentorScheduleConfig } from './MentorScheduleConfig';

interface BookingFormProps {
  isOwnMentorProfile: boolean;
  isUserDataLoading: boolean;
  isAuthenticated: boolean;
  slots: BookingSlot[];
  monthLoaded: boolean;
  selectedSlot: BookingSlot | null;
  setSelectedSlot: (slot: BookingSlot | null) => void;
  isSubmitting: boolean;
  selectedDate: string | null;
  onReservation: () => void;
  onConfirmReservation: (question?: string) => Promise<boolean>;
}

export function BookingForm({
  isOwnMentorProfile,
  isUserDataLoading,
  isAuthenticated,
  slots,
  monthLoaded,
  selectedSlot,
  setSelectedSlot,
  isSubmitting,
  selectedDate,
  onReservation,
  onConfirmReservation,
}: BookingFormProps) {
  // Prevent view flash: if userData is loading/unresolved, render a loading skeleton
  if (isUserDataLoading) {
    return (
      <div
        className="flex w-full max-w-[335px] animate-pulse flex-col gap-4 md:max-w-[695px] 2xl:max-w-[414px]"
        data-testid="booking-form-skeleton"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[335px] flex-col gap-4 md:max-w-[695px] 2xl:max-w-[414px]">
      {isOwnMentorProfile ? (
        <MentorScheduleConfig
          slots={slots}
          monthLoaded={monthLoaded}
          onReservation={onReservation}
        />
      ) : (
        <MenteeBookingForm
          slots={slots}
          monthLoaded={monthLoaded}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          isSubmitting={isSubmitting}
          selectedDate={selectedDate}
          onConfirmReservation={onConfirmReservation}
          isAuthenticated={isAuthenticated}
        />
      )}
    </div>
  );
}
