'use client';

import * as React from 'react';

import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import { ReservationIdentity } from '@/components/reservation/ReservationIdentity';
import { Button } from '@/components/ui/button';
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
            <Button
              onClick={() => joinMeet(reservation.id)}
              disabled={isJoiningMeet || isMutating}
              aria-label="加入 Google Meet"
              className="flex-1 bg-brand-500 font-semibold text-text-primary hover:bg-brand-500/90 sm:flex-none"
            >
              {isJoiningMeet ? (
                '載入中...'
              ) : (
                <>
                  <span className="sm:hidden">加入會議</span>
                  <span className="hidden sm:inline">加入 Google Meet</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
