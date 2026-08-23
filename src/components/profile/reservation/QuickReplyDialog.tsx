'use client';

import { CalendarDays, Clock, MessageSquare } from 'lucide-react';
import * as React from 'react';

import AcceptReservationDialog from '@/components/reservation/AcceptReservationDialog';
import RejectReservationDialog from '@/components/reservation/RejectReservationDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import type { Reservation } from '@/types/reservation';

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

  const initials =
    reservation.name
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2) || 'U';

  const menteeMessage = reservation.menteeMessage?.content;

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

          {/* Mentee Message block */}
          {menteeMessage ? (
            <div className="mt-6">
              <div className="text-text-primary mb-2 text-sm font-medium">
                學員留言
              </div>
              <div className="bg-background-bottom/40 flex items-start gap-2 rounded-2xl border p-4 text-xs sm:text-sm">
                <MessageSquare
                  className="text-text-tertiary mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                <p className="text-text-primary break-words whitespace-pre-wrap">
                  {menteeMessage}
                </p>
              </div>
            </div>
          ) : null}

          {/* Footer action buttons */}
          <DialogFooter className="mt-6 flex-row justify-end gap-2 sm:gap-2">
            <div className="flex w-full gap-2 sm:w-auto">
              <RejectReservationDialog
                reservation={reservation}
                disabled={isMutating}
                className="w-full sm:w-auto"
                onReject={async ({ reason }) =>
                  rejectOrCancel(reservation, reason, 'reject')
                }
              />
              <AcceptReservationDialog
                reservation={reservation}
                disabled={isMutating}
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
