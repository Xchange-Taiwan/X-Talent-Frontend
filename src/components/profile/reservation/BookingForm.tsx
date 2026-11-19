'use client';

import { useRouter } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import type {
  BookingCalendarReader,
  BookingSlot,
  SlotsSnapshot,
} from '@/lib/profile/bookingAvailability';

import { MenteeBookingForm } from './MenteeBookingForm';
import { MentorScheduleConfig } from './MentorScheduleConfig';

const EMPTY_SLOTS_SNAPSHOT: SlotsSnapshot = {
  slots: [],
  monthLoaded: false,
  reservationsLoaded: false,
};

const NOOP_SET_SELECTED_SLOT = (_slot: BookingSlot | null) => {};

export interface BookingFormProps {
  isOwnMentorProfile: boolean;
  isUserDataLoading: boolean;
  isAuthenticated: boolean;
  isIdentityResolved?: boolean;
  mentorId?: number | string;
  myUserId?: string;
  reader?: BookingCalendarReader;
  /** Optional fallback / override for Storybook stories (#850) and isolated component tests when `reader` is omitted. */
  slotsSnapshot?: SlotsSnapshot;
  selectedSlot?: BookingSlot | null;
  setSelectedSlot?: (slot: BookingSlot | null) => void;
  selectedDate?: string | null;
  isSubmitting?: boolean;
  onReservation: () => void;
  onMutationSuccess?: () => void | Promise<void>;
}

export function BookingForm({
  isOwnMentorProfile,
  isUserDataLoading,
  isAuthenticated,
  isIdentityResolved = true,
  mentorId,
  myUserId,
  reader,
  slotsSnapshot,
  selectedSlot,
  setSelectedSlot,
  selectedDate,
  isSubmitting,
  onReservation,
  onMutationSuccess,
}: BookingFormProps) {
  const router = useRouter();
  const resolvedSlotsSnapshot =
    slotsSnapshot ?? reader?.slotsSnapshot ?? EMPTY_SLOTS_SNAPSHOT;
  const resolvedSelectedSlot =
    selectedSlot !== undefined ? selectedSlot : (reader?.selectedSlot ?? null);
  const resolvedSetSelectedSlot =
    setSelectedSlot ?? reader?.setSelectedSlot ?? NOOP_SET_SELECTED_SLOT;
  const resolvedSelectedDate =
    selectedDate !== undefined ? selectedDate : (reader?.selectedDate ?? null);
  const resolvedOnMutationSuccess = onMutationSuccess ?? reader?.reload;
  const { slots, monthLoaded } = resolvedSlotsSnapshot;

  // Prevent view flash: if userData is loading/unresolved, render a loading skeleton
  if (isUserDataLoading) {
    return (
      <div
        className="flex w-full max-w-[335px] animate-pulse flex-col gap-4 md:max-w-[695px] xl:max-w-[414px]"
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
    <div className="flex w-full max-w-[335px] flex-col gap-4 md:max-w-[695px] xl:max-w-[414px]">
      {isOwnMentorProfile ? (
        <MentorScheduleConfig
          slotsSnapshot={resolvedSlotsSnapshot}
          onReservation={onReservation}
          onBookedSlotClick={() => router.push('/reservation/mentor')}
          myUserId={myUserId}
          onMutationSuccess={resolvedOnMutationSuccess}
        />
      ) : (
        <MenteeBookingForm
          mentorId={mentorId}
          myUserId={myUserId}
          slots={slots}
          monthLoaded={monthLoaded}
          selectedSlot={resolvedSelectedSlot}
          setSelectedSlot={resolvedSetSelectedSlot}
          selectedDate={resolvedSelectedDate}
          isSubmitting={isSubmitting}
          isAuthenticated={isAuthenticated}
          isIdentityResolved={isIdentityResolved}
          onMutationSuccess={resolvedOnMutationSuccess}
        />
      )}
    </div>
  );
}
