'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { ReplyMessageField } from '@/components/reservation/ReplyMessageField';
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

          <ReservationIdentity
            reservation={reservation}
            variant="accept"
            sourceRole="mentor"
          />

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
            <ReplyMessageField
              open={replyOpen}
              onOpen={() => setReplyOpen(true)}
              disabled={isSubmitting}
              textareaProps={{
                value: reply,
                onChange: (e) => setReply(e.target.value),
              }}
            />
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
