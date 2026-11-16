'use client';

import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ParsedMentorTimeslot } from '@/lib/profile/bookingAvailability';
import {
  defaultFormForDate,
  type SlotFormState,
  snapMinute,
} from '@/lib/profile/scheduleFormatters';

import { DurationRadio, TimeSelectPair } from './SlotFormControls';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export interface AddSlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string | null;
  existingSlots: ParsedMentorTimeslot[];
  onSubmit: (form: SlotFormState, weeklyWithinMonth: boolean) => void;
}

export function AddSlotModal({
  open,
  onOpenChange,
  selectedDate,
  existingSlots,
  onSubmit,
}: AddSlotModalProps) {
  const existingSlotsRef = useRef(existingSlots);
  existingSlotsRef.current = existingSlots;

  const [form, setForm] = useState<SlotFormState>(() =>
    defaultFormForDate(existingSlots)
  );
  const [weekly, setWeekly] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(defaultFormForDate(existingSlotsRef.current));
      setWeekly(false);
    }
  }, [open, selectedDate]);

  const parsedSelectedDate = useMemo(() => {
    if (!selectedDate) return null;
    const parsed = dayjs(selectedDate);
    return parsed.isValid() ? parsed : null;
  }, [selectedDate]);

  const previewDates = useMemo(() => {
    if (!parsedSelectedDate || !weekly) return [];
    const dates: string[] = [];
    const startMonth = parsedSelectedDate.month();
    let cursor = parsedSelectedDate;
    while (cursor.month() === startMonth) {
      dates.push(cursor.format('M/D'));
      cursor = cursor.add(7, 'day');
    }
    return dates;
  }, [parsedSelectedDate, weekly]);

  const weekdayLabel = parsedSelectedDate
    ? (WEEKDAY_LABELS[parsedSelectedDate.day()] ?? '')
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...(!parsedSelectedDate ? { 'aria-describedby': undefined } : {})}
        className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>新增可預約時段</DialogTitle>
          {parsedSelectedDate && (
            <DialogDescription>
              {parsedSelectedDate.format('YYYY/MM/DD')} (週{weekdayLabel})
            </DialogDescription>
          )}
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

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={weekly}
              onCheckedChange={(v) => setWeekly(v === true)}
            />
            套用至本月剩餘的每週{weekdayLabel}
          </label>

          {weekly && previewDates.length > 0 && (
            <p className="text-text-tertiary text-sm">
              將建立 {previewDates.length} 個時段:{previewDates.join('、')}
            </p>
          )}
        </div>

        <DialogFooter className="justify-center gap-3 sm:gap-4 sm:space-x-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => onSubmit(form, weekly)}>建立</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
