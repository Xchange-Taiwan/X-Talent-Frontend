'use client';

import { CalendarDays, Clock, Loader2, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
  onReject?: (payload: { id: string; reason: string }) => Promise<void> | void;
}

export default function AcceptReservationDialog({
  reservation,
  className,
  onAccept,
  onReject,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'check' | 'reject'>('check');
  const [reason, setReason] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  function onOpenChange(next: boolean) {
    if (isSubmitting) return;
    setOpen(next);
    if (next) {
      setStep('check');
      setReason('');
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

  async function handleReject() {
    setIsSubmitting(true);
    try {
      await onReject?.({ id: reservation.id, reason });
      setIsSubmitting(false);
      setOpen(false);
    } catch {
      toast({
        variant: 'destructive',
        description: '拒絕預約失敗,請稍後再試',
      });
      setIsSubmitting(false);
    }
  }

  // counterpartyMessage on the mentor side is always the mentee's question.
  const menteeMessage =
    reservation.counterpartyMessage?.role === 'MENTEE'
      ? reservation.counterpartyMessage.content
      : undefined;
  const trimmedReason = reason.trim();
  const canSubmitReject = trimmedReason.length > 0 && !isSubmitting;

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
        {step === 'check' ? (
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-center sm:text-left">
                查看我的預約
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
                      placeholder="例如：屆時於 Google Meet 見，請先準備一份履歷。"
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
              <Button
                type="button"
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                onClick={() => setStep('reject')}
                disabled={isSubmitting}
              >
                拒絕
              </Button>

              <Button
                type="button"
                className="bg-teal-500 text-white hover:bg-teal-500/90 w-full sm:w-auto"
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
        ) : (
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-center sm:text-left">
                拒絕 Mentee 預約的原因
              </DialogTitle>
              <DialogDescription className="text-center sm:text-left">
                請說明無法接受此預約的原因。
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl border p-2">
              <Textarea
                placeholder="請在此輸入原因..."
                className="min-h-[120px] resize-y border-0 shadow-none focus-visible:ring-0"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {trimmedReason.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                請填寫拒絕原因
              </p>
            )}

            <DialogFooter className="mt-6 gap-2">
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={isSubmitting}
                >
                  捨棄
                </Button>
              </DialogClose>

              <Button
                type="button"
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                disabled={!canSubmitReject}
                onClick={handleReject}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                拒絕
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
