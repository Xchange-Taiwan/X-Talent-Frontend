'use client';

import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UseMentorScheduleReturn } from '@/hooks/useMentorSchedule';
import { trackEvent } from '@/lib/analytics';

import { ScheduleCalendar } from './ScheduleCalendar';

type EditingSlot = {
  id: number;
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
};

type SlotErrors = {
  timeRange?: string;
  overlap?: string;
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, '0')
);
const MINUTE_OPTIONS = ['00', '15', '30', '45'];

/** Snap a minute value to the nearest option in [0, 15, 30, 45]. */
const snapMinute = (m: number): string => {
  const snapped = [0, 15, 30, 45].reduce((prev, curr) =>
    Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev
  );
  return String(snapped).padStart(2, '0');
};

export default function MentorScheduleDialog({
  open,
  onOpenChange,
  schedule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: UseMentorScheduleReturn;
}) {
  const {
    selectedDate,
    setSelectedDate,
    draftForSelectedDate,
    addSlotForSelectedDate,
    deleteDraftSlot,
    confirmChanges,
    resetChanges,
    parsedDraft,
    updateDraftSlot,
    meetingDurationMinutes,
  } = schedule;

  const [isSaving, setIsSaving] = useState(false);
  const [editingSlots, setEditingSlots] = useState<EditingSlot[]>([]);
  const [slotErrors, setSlotErrors] = useState<Record<number, SlotErrors>>({});

  useEffect(() => {
    if (open) {
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: 'mentor_schedule' },
      });
    }
  }, [open]);

  useEffect(() => {
    setEditingSlots(
      draftForSelectedDate.map((slot) => ({
        id: slot.id,
        startHour: String(slot.start.getHours()).padStart(2, '0'),
        startMinute: snapMinute(slot.start.getMinutes()),
        endHour: String(slot.end.getHours()).padStart(2, '0'),
        endMinute: snapMinute(slot.end.getMinutes()),
      }))
    );
    setSlotErrors({});
  }, [draftForSelectedDate]);

  const allowedDates = parsedDraft
    .filter((slot) => slot.type === 'ALLOW')
    .map((slot) => slot.dateKey);

  const hasAnyError = Object.values(slotErrors).some(
    (e) => e.timeRange || e.overlap
  );

  const hasInvalidTimes = editingSlots.some((slot) => {
    const startTotal =
      parseInt(slot.startHour) * 60 + parseInt(slot.startMinute);
    const endTotal = parseInt(slot.endHour) * 60 + parseInt(slot.endMinute);
    return endTotal - startTotal < 30;
  });

  const handleSave = async () => {
    setIsSaving(true);
    await confirmChanges();
    setIsSaving(false);
    onOpenChange(false);
  };

  const checkOverlapWithOthers = (
    id: number,
    startTotal: number,
    endTotal: number
  ): boolean => {
    return parsedDraft
      .filter(
        (s) => s.type === 'ALLOW' && s.id !== id && s.dateKey === selectedDate
      )
      .some((s) => {
        const otherStart = s.start.getHours() * 60 + s.start.getMinutes();
        const otherEnd = s.end.getHours() * 60 + s.end.getMinutes();
        return startTotal < otherEnd && endTotal > otherStart;
      });
  };

  const handleTimeChange = (
    id: number,
    part: keyof Omit<EditingSlot, 'id'>,
    value: string
  ) => {
    const originalSlot = editingSlots.find((s) => s.id === id);
    if (!originalSlot) return;

    const updatedSlot = { ...originalSlot, [part]: value };
    setEditingSlots((prev) =>
      prev.map((slot) => (slot.id === id ? updatedSlot : slot))
    );

    const startTotal =
      parseInt(updatedSlot.startHour) * 60 + parseInt(updatedSlot.startMinute);
    const endTotal =
      parseInt(updatedSlot.endHour) * 60 + parseInt(updatedSlot.endMinute);

    if (endTotal <= startTotal) {
      setSlotErrors((prev) => ({
        ...prev,
        [id]: { timeRange: '結束時間必須晚於開始時間' },
      }));
      return;
    }

    if (checkOverlapWithOthers(id, startTotal, endTotal)) {
      setSlotErrors((prev) => ({
        ...prev,
        [id]: { overlap: '此時段與其他時段重疊' },
      }));
      return;
    }

    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    updateDraftSlot(id, {
      startTime: `${updatedSlot.startHour}:${updatedSlot.startMinute}`,
      endTime: `${updatedSlot.endHour}:${updatedSlot.endMinute}`,
    });
  };

  const addNewTimeSlot = () => {
    const slotsToday = parsedDraft
      .filter((s) => s.type === 'ALLOW' && s.dateKey === selectedDate)
      .sort((a, b) => a.end.getTime() - b.end.getTime());

    let startH = 9;
    let startM = 0;

    if (slotsToday.length > 0) {
      const lastEnd = slotsToday[slotsToday.length - 1].end;
      startH = lastEnd.getHours();
      startM = lastEnd.getMinutes();
      // snap to next 15-min boundary at or after lastEnd's minute
      const snapped = Math.ceil(startM / 15) * 15;
      if (snapped >= 60) {
        startH += 1;
        startM = 0;
      } else {
        startM = snapped;
      }
    }

    if (startH >= 24) return;

    const totalEndMin = startH * 60 + startM + meetingDurationMinutes;
    const endH = Math.floor(totalEndMin / 60);
    const endM = totalEndMin % 60;

    if (endH >= 24) return;

    addSlotForSelectedDate({
      type: 'ALLOW',
      startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
    });
  };

  const renderTimeSelect = (
    id: number,
    part: keyof Omit<EditingSlot, 'id'>,
    value: string,
    options: string[],
    hasError: boolean
  ) => (
    <Select value={value} onValueChange={(v) => handleTimeChange(id, part, v)}>
      <SelectTrigger
        className={`w-14 px-2 ${hasError ? 'border-red-500' : ''}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const MIN_DURATION = 30; // minutes

  const getEndHourOptions = (slot: EditingSlot): string[] => {
    const minEnd =
      parseInt(slot.startHour) * 60 + parseInt(slot.startMinute) + MIN_DURATION;
    // Keep hours where at least one minute option (max = 45) yields endTotal >= minEnd
    return HOUR_OPTIONS.filter((h) => parseInt(h) * 60 + 45 >= minEnd);
  };

  const getEndMinuteOptions = (slot: EditingSlot): string[] => {
    const minEnd =
      parseInt(slot.startHour) * 60 + parseInt(slot.startMinute) + MIN_DURATION;
    return MINUTE_OPTIONS.filter(
      (m) => parseInt(slot.endHour) * 60 + parseInt(m) >= minEnd
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>排程設定</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <ScheduleCalendar
            selected={
              selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()
            }
            onSelect={(d) =>
              setSelectedDate(
                d
                  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  : null
              )
            }
            allowedDates={allowedDates}
            showTodayStyle={false}
            disableEmptyDates={false}
            disablePastDates={true}
            highlightAvailableDates={true}
          />

          <div>
            <p className="font-semibold">可預約時段</p>
            <div className="mt-3 flex flex-col gap-3">
              {editingSlots.map((slot, index) => {
                const errors = slotErrors[slot.id] ?? {};
                const hasError = Boolean(errors.timeRange || errors.overlap);
                const endHourOptions = getEndHourOptions(slot);
                const endMinuteOptions = getEndMinuteOptions(slot);
                return (
                  <div key={slot.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      {renderTimeSelect(
                        slot.id,
                        'startHour',
                        slot.startHour,
                        HOUR_OPTIONS,
                        hasError
                      )}
                      <span className="text-muted-foreground">:</span>
                      {renderTimeSelect(
                        slot.id,
                        'startMinute',
                        slot.startMinute,
                        MINUTE_OPTIONS,
                        hasError
                      )}
                      <span className="mx-1 text-muted-foreground">–</span>
                      {renderTimeSelect(
                        slot.id,
                        'endHour',
                        slot.endHour,
                        endHourOptions,
                        hasError
                      )}
                      <span className="text-muted-foreground">:</span>
                      {renderTimeSelect(
                        slot.id,
                        'endMinute',
                        slot.endMinute,
                        endMinuteOptions,
                        hasError
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDraftSlot(slot.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {index === editingSlots.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={addNewTimeSlot}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {errors.timeRange && (
                      <p className="text-red-500 text-xs">{errors.timeRange}</p>
                    )}
                    {errors.overlap && (
                      <p className="text-red-500 text-xs">{errors.overlap}</p>
                    )}
                  </div>
                );
              })}

              {draftForSelectedDate.length === 0 && (
                <Button
                  variant="ghost"
                  onClick={addNewTimeSlot}
                  className="w-full"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="justify-center">
          <Button
            variant="outline"
            onClick={() => {
              resetChanges();
              onOpenChange(false);
            }}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || hasAnyError || hasInvalidTimes}
          >
            {isSaving ? '儲存中...' : '儲存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
