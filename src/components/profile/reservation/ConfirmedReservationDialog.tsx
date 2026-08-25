'use client';

import { CalendarDays, Clock, Mail, MessageSquare } from 'lucide-react';
import * as React from 'react';

import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import { ReservationStatusBadge } from '@/components/reservation/ReservationStatusBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { useReservationMeetLink } from '@/hooks/user/reservation/useReservationMeetLink';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import { getInitials } from '@/lib/avatar/getInitials';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import type { Reservation } from '@/types/reservation';

import { ProfileLinkWrapper } from './ProfileLinkWrapper';

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
  const menteeId = resolveCounterpartyId(reservation, myUserId || '');
  const profileHref = menteeId ? `/profile/${menteeId}` : undefined;
  const menteeMessage = reservation.menteeMessage?.content;

  const handleProfileLinkClick = (e: React.MouseEvent) => {
    if (isMutating || isJoiningMeet) {
      e.preventDefault();
      return;
    }
    onOpenChange(false);
  };

  const avatarContent = (
    <Avatar className="size-10 sm:size-12">
      <AvatarImage
        src={
          reservation.avatar ? getAvatarThumbUrl(reservation.avatar) : undefined
        }
        alt={reservation.name}
      />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );

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

          {/* User Details Block */}
          <div className="rounded-2xl border p-3.5 sm:p-5">
            <div className="flex w-full min-w-0 items-center gap-3">
              <ProfileLinkWrapper
                href={profileHref}
                onClick={handleProfileLinkClick}
                disabled={isMutating || isJoiningMeet}
                className="shrink-0 rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                ariaLabel={`查看 ${reservation.name} 的個人資料`}
              >
                {avatarContent}
              </ProfileLinkWrapper>
              <div className="min-w-0 flex-1">
                <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
                  <ProfileLinkWrapper
                    href={profileHref}
                    onClick={handleProfileLinkClick}
                    disabled={isMutating || isJoiningMeet}
                    className="group block min-w-0 flex-1 truncate rounded-sm no-underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <span className="block truncate font-medium hover:underline sm:text-base">
                      {reservation.name}
                    </span>
                  </ProfileLinkWrapper>
                  <ReservationStatusBadge
                    dtstart={reservation.dtstart}
                    dtend={reservation.dtend}
                    className="shrink-0 px-1.5 text-11 font-normal"
                  />
                </div>
                <div className="truncate text-xs text-text-tertiary sm:text-sm">
                  {reservation.roleLine}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-text-tertiary sm:grid-cols-2 sm:text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{reservation.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{reservation.time}</span>
              </div>
            </div>

            {/* Meeting Info Block */}
            <div className="mt-3 flex items-center gap-1.5 text-11 text-text-tertiary sm:text-xs">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              <span>會議連結已寄至您的信箱</span>
            </div>
          </div>

          {/* Mentee Message block */}
          {menteeMessage ? (
            <div className="mt-6">
              <div className="mb-2 text-sm font-medium text-text-primary">
                學員留言
              </div>
              <div className="flex items-start gap-2 rounded-2xl border bg-background-bottom/40 p-4 text-xs sm:text-sm">
                <MessageSquare
                  className="mt-0.5 size-4 shrink-0 text-text-tertiary"
                  aria-hidden
                />
                <p className="break-words whitespace-pre-wrap text-text-primary">
                  {menteeMessage}
                </p>
              </div>
            </div>
          ) : null}

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
