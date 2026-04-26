'use client';

import { CalendarDays, Clock, Loader2 } from 'lucide-react';
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
  const [step, setStep] = useState<'confirm' | 'reason'>('confirm');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Reset to the first step every time the dialog opens
  function onOpenChange(next: boolean) {
    if (isSubmitting) return;
    setOpen(next);
    if (next) {
      setStep('confirm');
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

  const initials =
    reservation.name
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2) || 'U';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn('min-h-9 px-3 text-destructive', className)}
          onClick={() => setOpen(true)}
        >
          取消預約
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        {step === 'confirm' ? (
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-center sm:text-left">
                取消預約
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-xl border p-4 sm:p-5">
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

            <DialogFooter className="mt-6 gap-2">
              <DialogClose asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  維持預約
                </Button>
              </DialogClose>
              <Button
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                onClick={() => setStep('reason')}
              >
                取消預約
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-center sm:text-left">
                取消原因
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
                disabled={reason.trim().length === 0 || isSubmitting}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
