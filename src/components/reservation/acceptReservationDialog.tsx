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
  onAccept?: (payload: { id: string; message: string }) => Promise<void> | void;
  onReject?: (payload: { id: string; reason: string }) => Promise<void> | void;
};

export default function AcceptReservationDialog({
  reservation,
  className,
  onAccept,
  onReject,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'check' | 'reject'>('check');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStep('check');
      setMessage('');
      setReason('');
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
        <Button size="sm" className={cn('min-h-9 px-3', className)}>
          Accept
        </Button>
      </DialogTrigger>

      {/* RWD: 手機 90vw、桌機 lg 尺寸；邊距留白用 p-0 + 內層 p-6 */}
      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        {step === 'check' ? (
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-center sm:text-left">
                Check Reservation
              </DialogTitle>
              <DialogDescription className="text-center sm:text-left">
                Review the details and optionally add a question for this
                booking.
              </DialogDescription>
            </DialogHeader>

            {/* Summary card */}
            <div className="rounded-2xl border p-4 sm:p-5">
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

            {/* Question area */}
            <div className="mt-6">
              <div className="mb-2 text-sm font-medium">
                Question about this booking.
              </div>
              <div className="rounded-2xl border p-2">
                <Textarea
                  placeholder={`Hello ${reservation.name.split(' ')[0]}, ...`}
                  className="min-h-[120px] resize-y border-0 shadow-none focus-visible:ring-0"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2">
              {/* 進到拒絕理由的第二步 */}
              <Button
                type="button"
                variant="secondary"
                className="w-full bg-secondary text-destructive hover:bg-secondary/80 sm:w-auto"
                onClick={() => setStep('reject')}
              >
                Reject
              </Button>

              {/* 接受 */}
              <Button
                type="button"
                className="bg-teal-500 text-white hover:bg-teal-500/90 w-full sm:w-auto"
                onClick={async () => {
                  await onAccept?.({ id: reservation.id, message });
                  setOpen(false);
                }}
              >
                Accept
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-center sm:text-left">
                Reason for Rejection
              </DialogTitle>
              <DialogDescription className="text-center sm:text-left">
                Tell the mentee why this booking can’t be accepted.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl border p-2">
              <Textarea
                placeholder="Write your reason..."
                className="min-h-[120px] resize-y border-0 shadow-none focus-visible:ring-0"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <DialogFooter className="mt-6 gap-2">
              {/* 關閉視窗 */}
              <DialogClose asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  Discard
                </Button>
              </DialogClose>

              {/* 確認拒絕 */}
              <Button
                type="button"
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                disabled={reason.trim().length === 0}
                onClick={async () => {
                  await onReject?.({ id: reservation.id, reason });
                  setOpen(false);
                }}
              >
                Yes, reject it.
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
