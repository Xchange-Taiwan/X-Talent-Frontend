'use client';

import { AlertCircle, CalendarDays, Clock, MessageSquare } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trackEvent } from '@/lib/analytics';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import { getInitials } from '@/lib/avatar/getInitials';
import { resolveSystemAutoCancelNotice } from '@/lib/reservation/reservationLifecyclePolicy';
import { resolveReservationMessages } from '@/lib/reservation/resolveReservationMessages';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import type {
  MessageRole,
  Reservation,
  ReservationMessage,
} from '@/types/reservation';

interface Props {
  reservation: Reservation;
  // Which role the current user is browsing as. Used only for analytics so we
  // can tell whether the mentor or mentee opened the thread; never sent as
  // message content.
  sourceRole: 'mentor' | 'mentee';
  trigger?: React.ReactNode;
}

const ROLE_LABEL: Record<MessageRole, string> = {
  MENTEE: '學員',
  MENTOR: '導師',
};

export default function ReservationConversationDialog({
  reservation,
  sourceRole,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);

  const { messages: resolvedMessages, cancelReasonMessage } =
    resolveReservationMessages(reservation);
  const hasCancelReason = Boolean(cancelReasonMessage);
  const systemCancelNotice = resolveSystemAutoCancelNotice(
    reservation,
    sourceRole
  );

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      trackEvent({
        name: 'reservation_conversation_opened',
        feature: 'reservation',
        metadata: {
          reservation_id: reservation.id,
          source_role: sourceRole,
          message_count: resolvedMessages.length,
        },
      });
    }
  }

  const initials = getInitials(reservation.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className={cn(
              'text-text-tertiary hover:text-text-primary inline-flex items-center gap-1 rounded-sm text-xs focus-visible:outline-none sm:text-sm',
              FOCUS_RING_CLASSES
            )}
          >
            <MessageSquare className="size-3.5" aria-hidden />
            查看完整對話
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] w-[92vw] max-w-[480px] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="space-y-3 border-b p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <Avatar className="size-10 shrink-0">
              {reservation.avatar ? (
                <AvatarImage
                  src={getAvatarThumbUrl(reservation.avatar)}
                  alt={reservation.name}
                />
              ) : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="truncate text-base">
                完整對話紀錄
              </DialogTitle>
              <DialogDescription className="truncate">
                {reservation.name}
                {reservation.roleLine ? ` · ${reservation.roleLine}` : ''}
              </DialogDescription>
            </div>
          </div>
          <div className="text-text-tertiary flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden />
              {reservation.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden />
              {reservation.time}
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          {systemCancelNotice ? (
            <div
              role="note"
              className="border-status-warning-default/40 bg-status-warning-active/15 text-text-primary flex items-start gap-2 rounded-lg border p-3 text-xs sm:text-sm"
            >
              <AlertCircle
                className="text-status-info-default mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <span>{systemCancelNotice}</span>
            </div>
          ) : null}

          {resolvedMessages.length === 0 ? (
            <p className="text-text-tertiary py-8 text-center text-sm">
              尚無對話內容
            </p>
          ) : (
            resolvedMessages.map((message, index, array) => (
              <MessageBubble
                key={index}
                message={message}
                hasCancelReason={hasCancelReason}
                isPrevSameRole={
                  index > 0 &&
                  !message.isCancelReason &&
                  !array[index - 1].isCancelReason &&
                  array[index - 1].role === message.role
                }
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MessageBubble({
  message,
  hasCancelReason,
  isPrevSameRole,
}: {
  message: ReservationMessage;
  hasCancelReason: boolean;
  isPrevSameRole: boolean;
}) {
  const isMentor = message.role === 'MENTOR';
  const isMentee = message.role === 'MENTEE';
  const isCancelReason = Boolean(message.isCancelReason);
  const label = message.role ? ROLE_LABEL[message.role] : '';
  const tagLabel = isCancelReason
    ? '取消原因'
    : hasCancelReason && isMentee
      ? '預約提問'
      : '';
  const showHeader = isCancelReason || (Boolean(label) && !isPrevSameRole);

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        isMentor ? 'items-end' : 'items-start'
      )}
    >
      {showHeader ? (
        <div className="text-11 text-text-tertiary flex items-center gap-1.5 font-medium sm:text-xs">
          {label ? <span>{label}</span> : null}
          {tagLabel ? (
            <span
              className={cn(
                'text-11 rounded px-1.5 py-0.5 font-medium',
                isCancelReason
                  ? 'bg-status-error-default/10 text-status-error-default'
                  : 'bg-background-bottom text-text-secondary'
              )}
            >
              {tagLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm break-words whitespace-pre-wrap',
          isMentor && 'bg-brand-500 text-text-primary',
          isMentee && 'bg-background-bottom text-text-primary',
          !message.role && 'bg-background-bottom/60 text-text-tertiary'
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
