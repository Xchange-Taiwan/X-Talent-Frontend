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
import { useProfileLinkClick } from '@/hooks/reservation/useProfileLinkClick';
import { trackEvent } from '@/lib/analytics';
import {
  isFailedReservationDecision,
  validateReservationDecisionText,
} from '@/lib/reservation/executeReservationDecision';
import {
  isReservationMessagesProjected,
  isReservationViewerProjected,
  resolveReservationMessages,
  resolveReservationViewer,
} from '@/lib/reservation/reservationProjection';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';

interface Props {
  reservation: Reservation;
  myUserId?: string | number;
  className?: string;
  disabled?: boolean;
  size?: ButtonProps['size'];
  /** Resolve a named `{ ok: false }` result to keep the dialog open. */
  onAccept?: (payload: {
    id: string;
    message: string;
  }) => Promise<unknown> | unknown;
}

export default function AcceptReservationDialog({
  reservation,
  myUserId,
  className,
  disabled = false,
  size = 'sm',
  onAccept,
}: Props) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState('');

  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const replyValidation = validateReservationDecisionText('accept', reply);
  const replyError = replyValidation.ok ? undefined : replyValidation.message;

  const onOpenChange = (next: boolean) => {
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
  };

  const profileHref = isReservationViewerProjected(reservation, myUserId)
    ? myUserId
      ? reservation.profileHref
      : undefined
    : resolveReservationViewer({ reservation, myUserId }).profileHref;
  const menteeMessage = isReservationMessagesProjected(reservation)
    ? reservation.menteeMessage?.content
    : resolveReservationMessages(reservation).menteeMessage?.content;

  // Close the dialog before following the profile link, matching
  // ConfirmedReservationDialog / QuickReplyDialog's behavior.
  const handleProfileLinkClick = useProfileLinkClick({
    disabled: isSubmitting || disabled,
    onNavigate: () => setOpen(false),
  });

  const handleAccept = async () => {
    if (!replyValidation.ok || isSubmitting) return;
    setIsSubmitting(true);
    let keepOpen = false;
    try {
      const result = await onAccept?.({
        id: reservation.id,
        message: replyValidation.value,
      });
      keepOpen = isFailedReservationDecision(result);
    } catch (error) {
      keepOpen = true;
      console.error(
        '[AcceptReservationDialog] accept failed:',
        error instanceof Error ? error.name : 'unknown'
      );
    } finally {
      setIsSubmitting(false);
    }
    if (!keepOpen) setOpen(false);
  };

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
            profileHref={profileHref}
            onProfileLinkClick={handleProfileLinkClick}
            disabled={isSubmitting || disabled}
            variant="accept"
            sourceRole="mentor"
          />

          {menteeMessage ? (
            <div className="mt-6">
              <div className="mb-2 text-sm font-medium">學員所提出的問題</div>
              <div
                data-clarity-mask="true"
                className="bg-background-bottom/40 rounded-2xl border p-4 text-sm"
              >
                <p className="text-text-primary whitespace-pre-wrap">
                  {menteeMessage}
                </p>
              </div>
            </div>
          ) : null}

          <div data-clarity-mask="true" className="mt-6">
            <ReplyMessageField
              open={replyOpen}
              onOpen={() => setReplyOpen(true)}
              disabled={isSubmitting}
              error={replyError}
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
              onClick={() => void handleAccept()}
              disabled={isSubmitting || disabled || Boolean(replyError)}
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
