'use client';

import { CalendarDays, Clock } from 'lucide-react';
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
import { cn } from '@/lib/utils';

import type { Reservation } from './types';

type Props = {
  reservation: Reservation;
  className?: string;
  onConfirmCancel?: (payload: {
    id: string;
    reason: string;
  }) => Promise<void> | void;
};

export default function CancelReservationDialog({
  reservation,
  className,
  onConfirmCancel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'confirm' | 'reason'>('confirm');
  const [reason, setReason] = useState('');

  // 每次打開 dialog 重置成第一步
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStep('confirm');
      setReason('');
    }
  }

  async function handleConfirm() {
    await onConfirmCancel?.({ id: reservation.id, reason });
    setOpen(false);
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
          Cancel
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        {step === 'confirm' ? (
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-center sm:text-left">
                Cancel Reservation
              </DialogTitle>
              <DialogDescription className="text-center sm:text-left">
                Visual communication through imagery, typography, and color.
              </DialogDescription>
            </DialogHeader>

            {/* Summary card */}
            <div className="rounded-xl border p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={reservation.avatar}
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
                  Keep Reservation
                </Button>
              </DialogClose>
              <Button
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                onClick={() => setStep('reason')}
              >
                Cancel Reservation
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-center sm:text-left">
                Reason for Cancellation
              </DialogTitle>
              <DialogDescription className="text-center sm:text-left">
                Let the mentor know why you need to cancel.
              </DialogDescription>
            </DialogHeader>

            <Textarea
              placeholder={`Hello ${reservation.name.split(' ')[0]}, ...`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[140px] resize-y"
            />

            <DialogFooter className="mt-6 gap-2">
              <DialogClose asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  No, keep it.
                </Button>
              </DialogClose>
              <Button
                disabled={reason.trim().length === 0}
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                onClick={handleConfirm}
              >
                Yes, cancel it.
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
