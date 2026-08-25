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
import { useConfirmActionDialog } from '@/hooks/reservation/useConfirmActionDialog';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';

interface Props {
  reservation: Reservation;
  className?: string;
  disabled?: boolean;
  size?: ButtonProps['size'];
  onConfirmCancel?: (payload: {
    id: string;
    reason: string;
  }) => Promise<void> | void;
}

export default function CancelReservationDialog({
  reservation,
  className,
  disabled = false,
  size = 'sm',
  onConfirmCancel,
}: Props) {
  const [reason, setReason] = useState('');

  const { open, isSubmitting, onOpenChange, execute } = useConfirmActionDialog({
    errorMessage: '取消預約失敗,請稍後再試',
    onOpen: () => {
      setReason('');
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: 'cancel_reservation' },
      });
    },
  });

  const handleConfirm = () => {
    execute(async () => {
      await onConfirmCancel?.({ id: reservation.id, reason });
    });
  };

  const canSubmit = reason.trim().length > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size={size}
          variant="destructive"
          className={cn(size === 'sm' && 'min-h-9 px-3', className)}
          disabled={disabled}
        >
          取消預約
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-center sm:text-left">
              取消預約
            </DialogTitle>
            <DialogDescription className="text-center sm:text-left">
              請說明取消預約的原因。
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder={`您好 ${reservation.name.split(' ')[0]}，...`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[140px] resize-y"
            disabled={isSubmitting}
          />

          <DialogFooter className="mt-6 gap-2">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                維持預約
              </Button>
            </DialogClose>
            <Button
              disabled={!canSubmit || disabled}
              className="w-full bg-status-error-default text-text-white hover:bg-status-error-active sm:w-auto"
              onClick={handleConfirm}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              取消預約
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
