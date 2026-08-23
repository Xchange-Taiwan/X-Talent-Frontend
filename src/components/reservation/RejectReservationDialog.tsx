'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

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
import { useConfirmActionDialog } from '@/hooks/reservation/useConfirmActionDialog';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';

interface Props {
  reservation: Reservation;
  className?: string;
  disabled?: boolean;
  onReject?: (payload: { id: string; reason: string }) => Promise<void> | void;
}

export default function RejectReservationDialog({
  reservation,
  className,
  disabled = false,
  onReject,
}: Props) {
  const [reason, setReason] = useState('');

  const { open, isSubmitting, onOpenChange, execute } = useConfirmActionDialog({
    errorMessage: '拒絕預約失敗,請稍後再試',
    onOpen: () => {
      setReason('');
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: 'reject_reservation' },
      });
    },
  });

  const handleReject = () => {
    execute(async () => {
      await onReject?.({ id: reservation.id, reason });
    });
  };

  const trimmedReason = reason.trim();
  const canSubmit = trimmedReason.length > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="destructive"
          className={cn('min-h-9 px-3', className)}
          disabled={disabled}
        >
          拒絕
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-center sm:text-left">
              拒絕學員預約的原因
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

          <DialogFooter className="mt-6 gap-2">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                取消
              </Button>
            </DialogClose>

            <Button
              type="button"
              className="bg-status-error-default text-text-white hover:bg-status-error-active w-full sm:w-auto"
              disabled={!canSubmit || disabled}
              onClick={handleReject}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              拒絕
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
