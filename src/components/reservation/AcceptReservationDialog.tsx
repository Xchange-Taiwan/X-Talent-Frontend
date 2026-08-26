'use client';

import { Loader2, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';

import { ReservationIdentity } from '@/components/reservation/ReservationIdentity';
import { Button, type ButtonProps } from '@/components/ui/button';
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
import { useConfirmActionDialog } from '@/hooks/reservation/useConfirmActionDialog';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';

interface Props {
  reservation: Reservation;
  className?: string;
  disabled?: boolean;
  size?: ButtonProps['size'];
  onAccept?: (payload: { id: string; message: string }) => Promise<void> | void;
}

export default function AcceptReservationDialog({
  reservation,
  className,
  disabled = false,
  size = 'sm',
  onAccept,
}: Props) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState('');

  const { open, isSubmitting, onOpenChange, execute } = useConfirmActionDialog({
    errorMessage: '接受預約失敗,請稍後再試',
    onOpen: () => {
      setReply('');
      setReplyOpen(false);
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: 'accept_reservation' },
      });
    },
  });

  const handleAccept = () => {
    execute(async () => {
      await onAccept?.({ id: reservation.id, message: reply.trim() });
      trackEvent({
        name: 'reservation_accepted',
        feature: 'reservation',
        metadata: { has_reply: reply.trim().length > 0 },
      });
    });
  };

  const menteeMessage = reservation.menteeMessage?.content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size={size}
          className={cn(size === 'sm' && 'min-h-9 px-3', className)}
          disabled={disabled}
        >
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

          <ReservationIdentity reservation={reservation} variant="accept" />

          {menteeMessage ? (
            <div className="mt-6">
              <div className="mb-2 text-sm font-medium">學員所提出的問題</div>
              <div className="rounded-2xl border bg-background-bottom/40 p-4 text-sm">
                <p className="whitespace-pre-wrap text-text-primary">
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
                className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-primary"
                disabled={isSubmitting}
              >
                <MessageSquarePlus className="size-4" aria-hidden />
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
              disabled={isSubmitting || disabled}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              接受
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
