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
  onConfirmCancel?: (payload: {
    id: string;
    reason: string;
  }) => Promise<void> | void;
}

export default function CancelReservationDialog({
  reservation,
  className,
  onConfirmCancel,
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
        metadata: { dialog: 'cancel_reservation' },
      });
    }
  }

  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      await onConfirmCancel?.({ id: reservation.id, reason });
      setIsSubmitting(false);
      setOpen(false);
    } catch {
      toast({
        variant: 'destructive',
        description: '取消預約失敗,請稍後再試',
      });
      setIsSubmitting(false);
    }
  }

  const canSubmit = reason.trim().length > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="destructive"
          className={cn('min-h-9 px-3', className)}
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
              disabled={!canSubmit}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
              onClick={handleConfirm}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              取消預約
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
