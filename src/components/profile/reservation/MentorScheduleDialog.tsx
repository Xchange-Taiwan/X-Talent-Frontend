'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  expandRrule,
  UseMentorScheduleReturn,
} from '@/hooks/useMentorSchedule';
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

const snapMinute = (m: number): string => {
  const snapped = [0, 15, 30, 45].reduce((prev, curr) =>
    Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev
  );
  return String(snapped).padStart(2, '0');
};

const fmtTime = (unix: number): string => {
  const d = new Date(unix * 1000);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

export default function MentorScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onMonthChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: UseMentorScheduleReturn;
  onMonthChange?: (date: Date) => void;
}) {
  const {
    selectedDate,
    setSelectedDate,
    draftForSelectedDate,
    addSlotForSelectedDate,
    deleteDraftSlot,
    toggleOccurrence,
    confirmChanges,
    resetChanges,
    parsedDraft,
    allowedDates,
    updateDraftSlot,
    meetingDurationMinutes,
  } = schedule;

  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [editingSlots, setEditingSlots] = useState<EditingSlot[]>([]);
  const [slotErrors, setSlotErrors] = useState<Record<number, SlotErrors>>({});
  const [pendingPromptOpen, setPendingPromptOpen] = useState(false);

  useEffect(() => {
    if (open) {
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: 'mentor_schedule' },
      });
    }
  }, [open]);

  // Only ALLOW slots are editable; BOOKED/PENDING are read-only
  const editableSlotsForDate = draftForSelectedDate.filter(
    (s) => s.type === 'ALLOW'
  );

  // Collect booked dtstart values for the selected date (for locking sub-slots)
  const bookedStartsForDate = new Set(
    draftForSelectedDate
      .filter((s) => s.type === 'BOOKED')
      .map((s) => Math.floor(s.start.getTime() / 1000))
  );

  // PENDING occurrences must be cancelled via the reservation-management page,
  // not by excluding them from the schedule editor — see issue #144.
  const pendingStartsForDate = new Set(
    draftForSelectedDate
      .filter((s) => s.type === 'PENDING')
      .map((s) => Math.floor(s.start.getTime() / 1000))
  );

  useEffect(() => {
    setEditingSlots(
      editableSlotsForDate.map((slot) => {
        const endHM = fmtTime(Math.floor(slot.end.getTime() / 1000));
        const [endH, endM] = endHM.split(':');
        return {
          id: slot.id,
          startHour: String(slot.start.getHours()).padStart(2, '0'),
          startMinute: snapMinute(slot.start.getMinutes()),
          endHour: endH ?? '00',
          endMinute: snapMinute(parseInt(endM ?? '0')),
        };
      })
    );
    setSlotErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftForSelectedDate]);

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
        className={`w-12 px-1 ${hasError ? 'border-red-500' : ''}`}
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

  const MIN_DURATION = 30;

  const getEndHourOptions = (slot: EditingSlot): string[] => {
    const minEnd =
      parseInt(slot.startHour) * 60 + parseInt(slot.startMinute) + MIN_DURATION;
    return HOUR_OPTIONS.filter((h) => parseInt(h) * 60 + 45 >= minEnd);
  };

  const getEndMinuteOptions = (slot: EditingSlot): string[] => {
    const minEnd =
      parseInt(slot.startHour) * 60 + parseInt(slot.startMinute) + MIN_DURATION;
    return MINUTE_OPTIONS.filter(
      (m) => parseInt(slot.endHour) * 60 + parseInt(m) >= minEnd
    );
  };

  /** Render the sub-slot chips for an ALLOW block so mentor can toggle individual occurrences. */
  const renderSubSlots = (slotId: number) => {
    const parsed = editableSlotsForDate.find((s) => s.id === slotId);
    if (!parsed || parsed.type !== 'ALLOW' || !parsed.rrule) return null;

    const occurrences = expandRrule(
      Math.floor(parsed.start.getTime() / 1000),
      parsed.rrule
    );
    if (occurrences.length <= 1) return null;

    const slotDurSec = parsed.slotDurationSeconds;

    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {occurrences.map((occ) => {
          const isBooked = bookedStartsForDate.has(occ);
          const isPending = pendingStartsForDate.has(occ);
          const isExcluded = parsed.exdate?.includes(occ) ?? false;
          const startLabel = fmtTime(occ);
          const endLabel = fmtTime(occ + slotDurSec);

          const handleClick = () => {
            if (isPending) {
              setPendingPromptOpen(true);
              return;
            }
            toggleOccurrence(slotId, occ);
          };

          return (
            <button
              key={occ}
              type="button"
              disabled={isBooked}
              onClick={handleClick}
              className={[
                'rounded border px-2 py-0.5 text-xs transition-colors',
                isBooked
                  ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                  : isPending
                    ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
                    : isExcluded
                      ? 'bg-white border-gray-300 text-gray-400 line-through'
                      : 'border-primary bg-primary/10 text-primary hover:bg-primary/20',
              ].join(' ')}
            >
              {startLabel}–{endLabel}
              {isBooked && (
                <span className="ml-1 text-[10px] text-gray-400">已預約</span>
              )}
              {isPending && (
                <span className="ml-1 text-[10px] text-primary/70">已申請</span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[440px] lg:max-w-[560px]">
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
              onMonthChange={onMonthChange}
              allowedDates={allowedDates}
              showTodayStyle={false}
              disableEmptyDates={false}
              disablePastDates={true}
              highlightAvailableDates={true}
            />

            <div>
              <p className="font-semibold lg:text-lg">可預約時段</p>

              <div className="mt-3 flex flex-col gap-3">
                {editingSlots.map((slot, index) => {
                  const errors = slotErrors[slot.id] ?? {};
                  const hasError = Boolean(errors.timeRange || errors.overlap);
                  const endHourOptions = getEndHourOptions(slot);
                  const endMinuteOptions = getEndMinuteOptions(slot);

                  return (
                    <div
                      key={slot.id}
                      className="flex flex-col gap-2 rounded-lg p-3 lg:p-4"
                    >
                      <div className="flex flex-row flex-wrap items-center justify-between gap-2 lg:gap-3">
                        <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
                          {renderTimeSelect(
                            slot.id,
                            'startHour',
                            slot.startHour,
                            HOUR_OPTIONS,
                            hasError
                          )}

                          <span className="text-muted-foreground lg:text-base">
                            :
                          </span>

                          {renderTimeSelect(
                            slot.id,
                            'startMinute',
                            slot.startMinute,
                            MINUTE_OPTIONS,
                            hasError
                          )}

                          <span className="mx-1 text-muted-foreground lg:text-base">
                            –
                          </span>

                          {renderTimeSelect(
                            slot.id,
                            'endHour',
                            slot.endHour,
                            endHourOptions,
                            hasError
                          )}

                          <span className="text-muted-foreground lg:text-base">
                            :
                          </span>

                          {renderTimeSelect(
                            slot.id,
                            'endMinute',
                            slot.endMinute,
                            endMinuteOptions,
                            hasError
                          )}
                        </div>

                        <div className="flex shrink-0 justify-end gap-1 lg:ml-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 lg:h-10 lg:w-10"
                            onClick={() => deleteDraftSlot(slot.id)}
                          >
                            <X className="h-4 w-4 lg:h-5 lg:w-5" />
                          </Button>

                          {index === editingSlots.length - 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 lg:h-10 lg:w-10"
                              onClick={addNewTimeSlot}
                            >
                              <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {renderSubSlots(slot.id)}

                      {errors.timeRange && (
                        <p className="text-red-500 text-xs lg:text-sm">
                          {errors.timeRange}
                        </p>
                      )}

                      {errors.overlap && (
                        <p className="text-red-500 text-xs lg:text-sm">
                          {errors.overlap}
                        </p>
                      )}
                    </div>
                  );
                })}

                {editableSlotsForDate.length === 0 && (
                  <Button
                    variant="ghost"
                    onClick={addNewTimeSlot}
                    className="h-10 w-full lg:h-11 lg:text-base"
                  >
                    <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
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

      <Dialog open={pendingPromptOpen} onOpenChange={setPendingPromptOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>此時段有未處理的預約申請</DialogTitle>
            <DialogDescription>
              請至「預約管理」頁面接受或拒絕該申請,僅在拒絕後此時段才會重新釋出。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-center">
            <Button
              variant="outline"
              onClick={() => setPendingPromptOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                setPendingPromptOpen(false);
                onOpenChange(false);
                router.push('/reservation/mentor');
              }}
            >
              前往預約管理
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
