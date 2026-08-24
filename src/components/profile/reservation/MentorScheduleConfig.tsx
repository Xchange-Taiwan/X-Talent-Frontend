'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import type {
  BookingSlot,
  SlotsSnapshot,
} from '@/lib/profile/bookingAvailability';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';
import { isSlotTaken } from '@/lib/profile/scheduleHelpers';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import type { Reservation } from '@/types/reservation';

import { ConfirmedReservationDialog } from './ConfirmedReservationDialog';
import { QuickReplyDialog } from './QuickReplyDialog';

interface MentorScheduleConfigProps {
  slotsSnapshot: SlotsSnapshot;
  onReservation: () => void;
  onBookedSlotClick: () => void;
  myUserId?: string;
  /** schedule.reload — re-fetches reservations/schedule in place after a
   * quick-reply accept/reject, without a full page refresh. */
  onMutationSuccess?: () => void | Promise<void>;
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
  slotsSnapshot,
  onReservation,
  onBookedSlotClick,
  myUserId,
  onMutationSuccess,
}: MentorScheduleConfigProps) {
  const { slots, monthLoaded, reservationsLoaded } = slotsSnapshot;
  // Owned here (the leaf that renders the dialog) rather than lifted to the
  // profile page root: toggling this would otherwise re-render the entire
  // profile tree (banner, calendar, experience/education sections, ...) on
  // every quick-reply open/close.
  const [activeDialogType, setActiveDialogType] = useState<
    'quickReply' | 'confirmed' | null
  >(null);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);

  const isSlotBooked = isSlotTaken;

  const bookedSlots = slots.filter(isSlotBooked);
  const availableSlots = slots.filter((slot) => !isSlotBooked(slot));

  const handleBookedSlotClick = (slot: BookingSlot) => {
    if (slot.status === 'PENDING' && slot.reservation) {
      setSelectedReservation(slot.reservation);
      setActiveDialogType('quickReply');
      return;
    }
    if (slot.status === 'BOOKED' && slot.reservation) {
      setSelectedReservation(slot.reservation);
      setActiveDialogType('confirmed');
      return;
    }
    onBookedSlotClick();
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {/* 1. 已預約區塊 */}
      <div className="flex w-full flex-col items-start gap-3">
        <p className="text-sm font-semibold text-text-primary">已預約</p>
        {/* Also wait on reservationsLoaded: a slot's `status` (schedule
            fetch) can resolve before its `.reservation` (reservations
            fetch) does — most visibly right after this component remounts,
            e.g. navigating back to the profile page. Rendering the booked
            list before both are ready risks a PENDING slot with no
            `.reservation` attached yet, which would misfire
            handleBookedSlotClick's redirect fallback instead of opening the
            quick-reply dialog. */}
        {!monthLoaded || !reservationsLoaded ? (
          <LoadingIndicator />
        ) : bookedSlots.length === 0 ? (
          <div className="flex min-h-10 items-center text-sm text-text-disable">
            目前無已預約時段
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {bookedSlots.map((slot) => {
              const isPendingWithRes =
                slot.status === 'PENDING' && slot.reservation;
              const menteeId =
                isPendingWithRes && slot.reservation
                  ? resolveCounterpartyId(slot.reservation, myUserId || '')
                  : '';
              const profileHref = menteeId ? `/profile/${menteeId}` : undefined;
              const initials =
                isPendingWithRes && slot.reservation
                  ? slot.reservation.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                  : '';

              return (
                <div
                  key={`${slot.scheduleId}_${slot.start.getTime()}`}
                  role="button"
                  tabIndex={0}
                  className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-background-border px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-background-bottom/50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                  onClick={() => handleBookedSlotClick(slot)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleBookedSlotClick(slot);
                    }
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {isPendingWithRes && slot.reservation && profileHref ? (
                      <Link
                        href={profileHref}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="group shrink-0 rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
                        aria-label={`查看 ${slot.reservation.name} 的個人資料`}
                      >
                        <Avatar className="size-8">
                          <AvatarImage
                            src={
                              slot.reservation.avatar
                                ? getAvatarThumbUrl(slot.reservation.avatar)
                                : undefined
                            }
                            alt={slot.reservation.name}
                          />
                          <AvatarFallback className="text-xs font-medium">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    ) : null}

                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium text-text-primary">
                        {formatBookingSlotTime(slot)}
                      </span>
                      {isPendingWithRes && slot.reservation && profileHref ? (
                        <Link
                          href={profileHref}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="group rounded-sm focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
                        >
                          <span className="text-xs font-normal text-text-secondary group-hover:text-brand-500 group-hover:underline">
                            學員 {slot.reservation.name}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-xs font-normal text-text-secondary">
                          {slot.status === null
                            ? '時段已保留'
                            : slot.menteeName
                              ? `學員 ${slot.menteeName}`
                              : '學員'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      slot.status === 'PENDING'
                        ? 'text-status-warning-default'
                        : slot.status === 'BOOKED'
                          ? 'text-status-success-default'
                          : 'text-text-secondary'
                    }`}
                  >
                    {slot.status === 'PENDING'
                      ? '待您回復'
                      : slot.status === 'BOOKED'
                        ? '已確認'
                        : '已保留'}
                  </span>
                </div>
              );
            })}
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

      <QuickReplyDialog
        reservation={selectedReservation}
        open={activeDialogType === 'quickReply'}
        onOpenChange={(open) => !open && setActiveDialogType(null)}
        myUserId={myUserId}
        onMutationSuccess={onMutationSuccess}
      />

      <ConfirmedReservationDialog
        reservation={selectedReservation}
        open={activeDialogType === 'confirmed'}
        onOpenChange={(open) => !open && setActiveDialogType(null)}
        myUserId={myUserId}
        onMutationSuccess={onMutationSuccess}
      />
    </div>
  );
}
