'use client';

import { CalendarDays, Clock, Mail } from 'lucide-react';
import * as React from 'react';

import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { useReservationMeetLink } from '@/hooks/user/reservation/useReservationMeetLink';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import { getInitials } from '@/lib/avatar/getInitials';
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

  const initials = getInitials(reservation.name);

  const handleOpenChange = (next: boolean) => {
    if (isMutating || isJoiningMeet) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-center sm:text-left">
              已確認預約詳情
            </DialogTitle>
          </DialogHeader>

          {/* User Details Block */}
          <div className="rounded-2xl border p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Avatar className="size-10 sm:size-12">
                <AvatarImage
                  src={
                    reservation.avatar
                      ? getAvatarThumbUrl(reservation.avatar)
                      : undefined
                  }
                  alt={reservation.name}
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium sm:text-base">
                  {reservation.name}
                </div>
                <div className="text-text-tertiary truncate text-xs sm:text-sm">
                  {reservation.roleLine}
                </div>
              </div>
            </div>

            <div className="text-text-tertiary mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 sm:text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{reservation.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{reservation.time}</span>
              </div>
            </div>
          </div>

          {/* Meeting Info Block */}
          <div className="mt-6 flex items-center gap-2 rounded-2xl border bg-background-bottom/40 p-4">
            <Mail className="size-4 shrink-0 text-text-tertiary" aria-hidden />
            <span className="text-xs text-text-secondary sm:text-sm">
              會議連結已寄至您的信箱
            </span>
          </div>

          {/* Footer action buttons */}
          <DialogFooter className="mt-6">
            <CancelReservationDialog
              reservation={reservation}
              disabled={isMutating || isJoiningMeet}
              className="w-full sm:w-auto"
              onConfirmCancel={async ({ reason }) =>
                rejectOrCancel(reservation, reason, 'cancel')
              }
            />
            <Button
              onClick={() => joinMeet(reservation.id)}
              disabled={isJoiningMeet || isMutating}
              className="w-full bg-brand-500 font-semibold text-text-primary hover:bg-brand-500/90 sm:w-auto"
            >
              {isJoiningMeet ? '載入中...' : '加入 Google Meet'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
