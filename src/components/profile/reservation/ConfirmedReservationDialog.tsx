'use client';

import * as React from 'react';

import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import { JoinMeetButton } from '@/components/reservation/JoinMeetButton';
import { ReservationIdentity } from '@/components/reservation/ReservationIdentity';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { useReservationMeetLink } from '@/hooks/user/reservation/useReservationMeetLink';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import type { Reservation } from '@/types/reservation';

interface ConfirmedReservationDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  myUserId?: string;
  onMutationSuccess?: () => void | Promise<void>;
}

export function ConfirmedReservationDialog({
  reservation,
  open,
  onOpenChange,
  myUserId,
  onMutationSuccess,
}: ConfirmedReservationDialogProps) {
  const { rejectOrCancel, isMutating } = useReservationActions({
    myUserId,
    variant: 'upcoming',
    // This dialog only ever renders on the mentor's own calendar
    // (MentorScheduleConfig, reachable only via a mentor viewing their own
    // profile) - myRole is always 'mentor' here, by the platform's own
    // access rules, not something worth re-deriving defensively.
    myRole: 'mentor',
    onMutationSuccess: async () => {
      await onMutationSuccess?.();
      onOpenChange(false);
    },
  });

  const { joinMeet, isPending: isJoiningMeet } = useReservationMeetLink({
    myUserId,
  });

  if (!reservation) return null;

  const menteeId = resolveCounterpartyId(reservation, myUserId || '');
  const profileHref = menteeId ? `/profile/${menteeId}` : undefined;

  const handleProfileLinkClick = (e: React.MouseEvent) => {
    if (isMutating || isJoiningMeet) {
      e.preventDefault();
      return;
    }
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)
      return;
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (isMutating || isJoiningMeet) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        <div className="p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-center sm:text-left">
              已確認預約詳情
            </DialogTitle>
          </DialogHeader>

          <ReservationIdentity
            reservation={reservation}
            profileHref={profileHref}
            onProfileLinkClick={handleProfileLinkClick}
            disabled={isMutating || isJoiningMeet}
            showStatusBadge
            density="compact"
            sourceRole="mentor"
          />

          {/* Footer action buttons */}
          <div className="mt-6 flex w-full items-center gap-2 sm:justify-end">
            <CancelReservationDialog
              reservation={reservation}
              disabled={isMutating || isJoiningMeet}
              size="default"
              className="flex-1 sm:flex-none"
              onConfirmCancel={async ({ reason }) =>
                rejectOrCancel(reservation, reason, 'cancel')
              }
            />
            <JoinMeetButton
              onClick={() => joinMeet(reservation.id)}
              isPending={isJoiningMeet}
              disabled={isMutating}
              className="flex-1 font-semibold sm:flex-none"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
