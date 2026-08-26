'use client';

import * as React from 'react';

import AcceptReservationDialog from '@/components/reservation/AcceptReservationDialog';
import RejectReservationDialog from '@/components/reservation/RejectReservationDialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import type { Reservation } from '@/types/reservation';

import { ReservationIdentity } from './ReservationIdentity';

interface QuickReplyDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  myUserId?: string;
  onMutationSuccess?: () => void | Promise<void>;
}

export function QuickReplyDialog({
  reservation,
  open,
  onOpenChange,
  myUserId,
  onMutationSuccess,
}: QuickReplyDialogProps) {
  const { accept, rejectOrCancel, isMutating } = useReservationActions({
    myUserId,
    variant: 'pending-mentor',
    onMutationSuccess: async () => {
      // Await the reload before closing so the underlying page's calendar
      // and reservation list have already settled to the new state by the
      // time this dialog disappears, instead of exposing a stale PENDING
      // slot for one frame.
      await onMutationSuccess?.();
      onOpenChange(false);
    },
  });

  if (!reservation) return null;

  const menteeId = resolveCounterpartyId(reservation, myUserId || '');
  const profileHref = menteeId ? `/profile/${menteeId}` : undefined;

  const handleProfileLinkClick = (e: React.MouseEvent) => {
    if (isMutating) {
      e.preventDefault();
      return;
    }
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)
      return;
    onOpenChange(false);
  };

  // Block outside-click/Esc dismissal while a mutation is in flight: this
  // dialog is a single shared instance re-used across reservations, so an
  // early close followed by reopening a different slot would let the
  // in-flight request's completion handler close that unrelated dialog out
  // from under the user once it resolves.
  const handleOpenChange = (next: boolean) => {
    if (isMutating) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-center sm:text-left">
              待您回復的預約申請
            </DialogTitle>
          </DialogHeader>

          <ReservationIdentity
            reservation={reservation}
            profileHref={profileHref}
            onProfileLinkClick={handleProfileLinkClick}
            disabled={isMutating}
          />

          {/* Footer action buttons */}
          <DialogFooter className="mt-6 flex-row justify-end gap-2 sm:gap-2">
            <div className="flex w-full gap-2 sm:w-auto">
              <RejectReservationDialog
                reservation={reservation}
                disabled={isMutating}
                size="default"
                className="w-full sm:w-auto"
                onReject={async ({ reason }) =>
                  rejectOrCancel(reservation, reason, 'reject')
                }
              />
              <AcceptReservationDialog
                reservation={reservation}
                disabled={isMutating}
                size="default"
                className="w-full sm:w-auto"
                onAccept={async ({ message }) => accept(reservation, message)}
              />
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
