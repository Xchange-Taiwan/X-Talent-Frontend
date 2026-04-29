'use client';

import { CalendarDays, Clock, MessageSquare } from 'lucide-react';
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
import { cn } from '@/lib/utils';

import type { MessageRole, Reservation, ReservationMessage } from './types';

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

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      trackEvent({
        name: 'reservation_conversation_opened',
        feature: 'reservation',
        metadata: {
          reservation_id: reservation.id,
          source_role: sourceRole,
          message_count: reservation.messages.length,
        },
      });
    }
  }

  const initials =
    reservation.name
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2) || 'U';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            查看完整對話
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] w-[92vw] max-w-[480px] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="space-y-3 border-b p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {reservation.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {reservation.time}
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          {reservation.messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              尚無對話內容
            </p>
          ) : (
            reservation.messages.map((message, index) => (
              <MessageBubble
                key={index}
                message={message}
                isPrevSameRole={
                  index > 0 &&
                  reservation.messages[index - 1].role === message.role
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
  isPrevSameRole,
}: {
  message: ReservationMessage;
  isPrevSameRole: boolean;
}) {
  const isMentor = message.role === 'MENTOR';
  const isMentee = message.role === 'MENTEE';
  const label = message.role ? ROLE_LABEL[message.role] : '';

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        isMentor ? 'items-end' : 'items-start'
      )}
    >
      {label && !isPrevSameRole ? (
        <div className="text-[11px] font-medium text-muted-foreground sm:text-xs">
          {label}
        </div>
      ) : null}
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm',
          isMentor && 'bg-primary text-primary-foreground',
          isMentee && 'bg-muted text-foreground',
          !message.role && 'bg-muted/60 text-muted-foreground'
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
