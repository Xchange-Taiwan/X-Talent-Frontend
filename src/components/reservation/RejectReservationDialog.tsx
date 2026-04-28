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
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

import type { Reservation } from './types';

interface Props {
  reservation: Reservation;
  className?: string;
  onReject?: (payload: { id: string; reason: string }) => Promise<void> | void;
}

export default function RejectReservationDialog({
  reservation,
  className,
  onReject,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  function onOpenChange(next: boolean) {
    if (isSubmitting) return;
    setOpen(next);
    if (next) {
      setReason('');
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: 'reject_reservation' },
      });
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

  const trimmedReason = reason.trim();
  const canSubmit = trimmedReason.length > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="destructive"
          className={cn('min-h-9 px-3', className)}
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
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
              disabled={!canSubmit}
              onClick={handleReject}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              拒絕
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
