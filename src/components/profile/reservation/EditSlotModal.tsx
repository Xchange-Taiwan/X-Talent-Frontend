'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ParsedMentorTimeslot } from '@/lib/profile/bookingAvailability';
import {
  type SlotFormState,
  snapDuration,
  snapMinute,
} from '@/lib/profile/scheduleFormatters';

import { DurationRadio, TimeSelectPair } from './SlotFormControls';

export interface EditSlotModalProps {
  open: boolean;
  slot: ParsedMentorTimeslot | null;
  onClose: () => void;
  onSubmit: (form: SlotFormState) => void;
}

export function EditSlotModal({
  open,
  slot,
  onClose,
  onSubmit,
}: EditSlotModalProps) {
  const [form, setForm] = useState<SlotFormState>(() =>
    slot
      ? {
          startHour: String(slot.start.getHours()).padStart(2, '0'),
          startMinute: snapMinute(slot.start.getMinutes()),
          durationMinutes: snapDuration(slot.durationMinutes),
        }
      : {
          startHour: '09',
          startMinute: '00',
          durationMinutes: 30,
        }
  );

  useEffect(() => {
    if (open && slot) {
      setForm({
        startHour: String(slot.start.getHours()).padStart(2, '0'),
        startMinute: snapMinute(slot.start.getMinutes()),
        durationMinutes: snapDuration(slot.durationMinutes),
      });
    }
  }, [open, slot]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[400px]"
      >
        <DialogHeader>
          <DialogTitle>編輯時段</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">開始時間</p>
            <TimeSelectPair
              hourValue={form.startHour}
              minuteValue={form.startMinute}
              onHourChange={(v) => setForm((f) => ({ ...f, startHour: v }))}
              onMinuteChange={(v) => {
                const parsed = Number.parseInt(v, 10);
                if (Number.isNaN(parsed)) return;
                setForm((f) => ({
                  ...f,
                  startMinute: snapMinute(parsed),
                }));
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">會議長度</p>
            <DurationRadio
              value={form.durationMinutes}
              onChange={(v) => setForm((f) => ({ ...f, durationMinutes: v }))}
            />
          </div>
        </div>

        <DialogFooter className="justify-center gap-3 sm:gap-4 sm:space-x-0">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => onSubmit(form)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
