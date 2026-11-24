'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
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
import { trackEvent } from '@/lib/analytics';
import {
  isFailedReservationDecision,
  validateReservationDecisionText,
} from '@/lib/reservation/executeReservationDecision';
import { FOCUS_WITHIN_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';

export type ReservationReasonDialogKind = 'reject' | 'cancel';

export interface ReservationReasonPayload {
  id: string;
  reason: string;
}

interface ReasonDialogCopy {
  trigger: string;
  title: string;
  description: string;
  placeholder: (reservation: Reservation) => string;
  dismiss: string;
  submit: string;
  analyticsDialog: 'reject_reservation' | 'cancel_reservation';
}

const REASON_DIALOG_COPY: Record<
  ReservationReasonDialogKind,
  ReasonDialogCopy
> = {
  reject: {
    trigger: '拒絕',
    title: '拒絕學員預約的原因',
    description: '請說明無法接受此預約的原因。',
    placeholder: () => '請在此輸入原因...',
    dismiss: '取消',
    submit: '拒絕',
    analyticsDialog: 'reject_reservation',
  },
  cancel: {
    trigger: '取消預約',
    title: '取消預約',
    description: '請說明取消預約的原因。',
    placeholder: (reservation) => `您好 ${reservation.name.split(' ')[0]}，...`,
    dismiss: '維持預約',
    submit: '取消預約',
    analyticsDialog: 'cancel_reservation',
  },
};

export interface ReservationReasonDialogProps {
  kind: ReservationReasonDialogKind;
  reservation: Reservation;
  className?: string;
  disabled?: boolean;
  size?: ButtonProps['size'];
  /**
   * Submits the trimmed reason. Resolve a named `{ ok: false }` result (e.g.
   * from `useReservationActions`) to keep the dialog open; anything else
   * closes it. Error toasts are owned by the adapter, not this dialog.
   */
  onSubmit?: (payload: ReservationReasonPayload) => Promise<unknown> | unknown;
}

/**
 * Shared reason-required confirmation dialog behind `RejectReservationDialog`
 * and `CancelReservationDialog` (#977): one form shell, one validation rule,
 * one no-offset focus-within ring, one `feature_opened` event.
 */
export function ReservationReasonDialog({
  kind,
  reservation,
  className,
  disabled = false,
  size = 'sm',
  onSubmit,
}: ReservationReasonDialogProps) {
  const copy = REASON_DIALOG_COPY[kind];
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');

  const validation = validateReservationDecisionText(kind, reason);
  const canSubmit = validation.ok && !isSubmitting && !disabled;

  const handleOpenChange = (next: boolean) => {
    if (isSubmitting) return;
    setOpen(next);
    if (next) {
      setReason('');
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: copy.analyticsDialog },
      });
    }
  };

  const handleSubmit = async () => {
    if (!validation.ok || isSubmitting) return;
    setIsSubmitting(true);
    let keepOpen = false;
    try {
      const result = await onSubmit?.({
        id: reservation.id,
        reason: validation.value,
      });
      keepOpen = isFailedReservationDecision(result);
    } catch (error) {
      keepOpen = true;
      console.error(
        '[ReservationReasonDialog] submit failed:',
        error instanceof Error ? error.name : 'unknown'
      );
    } finally {
      setIsSubmitting(false);
    }
    if (!keepOpen) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size={size}
          variant="destructive"
          className={cn(size === 'sm' && 'min-h-9 px-3', className)}
          disabled={disabled}
        >
          {copy.trigger}
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-center sm:text-left">
              {copy.title}
            </DialogTitle>
            <DialogDescription className="text-center sm:text-left">
              {copy.description}
            </DialogDescription>
          </DialogHeader>

          <div
            data-clarity-mask="true"
            className={cn(
              'rounded-2xl border p-2 transition-shadow',
              FOCUS_WITHIN_RING_NO_OFFSET_CLASSES
            )}
          >
            <Textarea
              placeholder={copy.placeholder(reservation)}
              className="min-h-[120px] resize-y border-0 shadow-none focus-visible:ring-0 focus-visible:outline-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
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
                {copy.dismiss}
              </Button>
            </DialogClose>

            <Button
              type="button"
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {copy.submit}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ReservationReasonDialog;
