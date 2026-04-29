'use client';

import { CalendarDays, Clock, Loader2, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import { cn } from '@/lib/utils';

import type { Reservation } from './types';

interface Props {
  reservation: Reservation;
  className?: string;
  onAccept?: (payload: { id: string; message: string }) => Promise<void> | void;
}

export default function AcceptReservationDialog({
  reservation,
  className,
  onAccept,
}: Props) {
  const [open, setOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  function onOpenChange(next: boolean) {
    if (isSubmitting) return;
    setOpen(next);
    if (next) {
      setReply('');
      setReplyOpen(false);
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: 'accept_reservation' },
      });
    }
  }

  async function handleAccept() {
    setIsSubmitting(true);
    try {
      await onAccept?.({ id: reservation.id, message: reply.trim() });
      trackEvent({
        name: 'reservation_accepted',
        feature: 'reservation',
        metadata: { has_reply: reply.trim().length > 0 },
      });
      setIsSubmitting(false);
      setOpen(false);
    } catch {
      toast({
        variant: 'destructive',
        description: '接受預約失敗,請稍後再試',
      });
      setIsSubmitting(false);
    }
  }

  const menteeMessage = reservation.menteeMessage?.content;

  const initials =
    reservation.name
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2) || 'U';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className={cn('min-h-9 px-3', className)}>
          接受
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-center sm:text-left">
              接受學員預約
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-2xl border p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
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
              <div className="min-w-0">
                <div className="truncate font-medium">{reservation.name}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {reservation.roleLine}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>{reservation.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{reservation.time}</span>
              </div>
            </div>
          </div>

          {menteeMessage ? (
            <div className="mt-6">
              <div className="mb-2 text-sm font-medium">學員所提出的問題</div>
              <div className="rounded-2xl border bg-muted/40 p-4 text-sm">
                <p className="whitespace-pre-wrap text-foreground">
                  {menteeMessage}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            {replyOpen ? (
              <div>
                <div className="mb-2 text-sm font-medium">
                  給學員的回覆（選填）
                </div>
                <div className="rounded-2xl border p-2">
                  <Textarea
                    placeholder="例如：屆時於 Google Meet 見,請先準備一份履歷。"
                    className="min-h-[96px] resize-y border-0 shadow-none focus-visible:ring-0"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setReplyOpen(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                disabled={isSubmitting}
              >
                <MessageSquarePlus className="h-4 w-4" aria-hidden />
                附上回覆訊息（選填）
              </button>
            )}
          </div>

          <DialogFooter className="mt-6 gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                取消
              </Button>
            </DialogClose>

            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleAccept}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              接受
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
