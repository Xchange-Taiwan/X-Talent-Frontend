'use client';

import dayjs from 'dayjs';
import { Clock, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { KeyboardEvent, useEffect, useMemo, useState } from 'react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  SlotDurationMinutes,
  UseMentorScheduleReturn,
} from '@/hooks/useMentorSchedule';
import { trackEvent } from '@/lib/analytics';
import {
  defaultFormForDate,
  DURATION_OPTIONS,
  fmtTime,
  SlotFormState,
  snapDuration,
  snapMinute,
} from '@/lib/profile/scheduleFormatters';
import { DtType, ParsedMentorTimeslot } from '@/lib/profile/scheduleHelpers';
import { cn } from '@/lib/utils';

import { ScheduleCalendar } from './ScheduleCalendar';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, '0')
);
const MINUTE_OPTIONS = ['00', '15', '30', '45'];
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

type ReservationPromptType = Exclude<DtType, 'ALLOW'> | null;

type ActiveDialog =
  | { kind: 'add' }
  | { kind: 'edit'; id: number; occurrenceUnix: number }
  | { kind: 'prompt'; prompt: Exclude<DtType, 'ALLOW'> }
  | null;

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
    confirmChanges,
    resetChanges,
    updateDraftSlot,
    allowedDates,
    monthLoaded,
  } = schedule;

  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [lastPrompt, setLastPrompt] =
    useState<Exclude<DtType, 'ALLOW'>>('BOOKED');

  useEffect(() => {
    if (activeDialog?.kind === 'prompt') {
      setLastPrompt(activeDialog.prompt);
    }
  }, [activeDialog]);

  useEffect(() => {
    if (open) {
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: 'mentor_schedule' },
      });
    }
  }, [open]);

  // Show all ALLOW slots (including past) so the editor stays consistent with
  // what was scheduled; past slots render disabled to make it clear they
  // can't be edited or deleted. BOOKED/PENDING are tracked separately below
  // because reservation lifecycle is managed on a different page.
  const nowSec = Math.floor(Date.now() / 1000);
  const visibleSlots = draftForSelectedDate.filter((s) => s.type === 'ALLOW');
  // Future-only subset used for the AddSlotModal "next slot" default — we
  // don't want the picker to suggest a time that's already in the past.
  const futureSlots = visibleSlots.filter(
    (s) => Math.floor(s.start.getTime() / 1000) > nowSec
  );

  // Block deletion/edit when a BOOKED or PENDING reservation exists at this
  // slot's start. With one row per slot, the start timestamp is the natural
  // identity to match against reservation segments.
  const bookedStarts = useMemo(
    () =>
      new Set(
        draftForSelectedDate
          .filter((s) => s.type === 'BOOKED')
          .map((s) => Math.floor(s.start.getTime() / 1000))
      ),
    [draftForSelectedDate]
  );
  const pendingStarts = useMemo(
    () =>
      new Set(
        draftForSelectedDate
          .filter((s) => s.type === 'PENDING')
          .map((s) => Math.floor(s.start.getTime() / 1000))
      ),
    [draftForSelectedDate]
  );

  const getReservationBlock = (
    slot: ParsedMentorTimeslot
  ): ReservationPromptType => {
    const slotStart = Math.floor(slot.start.getTime() / 1000);
    if (bookedStarts.has(slotStart)) return 'BOOKED';
    if (pendingStarts.has(slotStart)) return 'PENDING';
    return null;
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await confirmChanges();
    setIsSaving(false);
    if (!result.ok) {
      toast({
        variant: 'destructive',
        description:
          result.reason === 'conflict'
            ? '此時段與既有預約衝突,請調整後再試'
            : '儲存失敗,請稍後再試',
      });
      return;
    }
    onOpenChange(false);
  };

  const editingSlot =
    activeDialog?.kind === 'edit'
      ? (visibleSlots.find(
          (s) =>
            s.id === activeDialog.id &&
            s.occurrenceUnix === activeDialog.occurrenceUnix
        ) ?? null)
      : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-[440px] lg:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>設定可預約時段</DialogTitle>
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
              isMonthLoading={!monthLoaded}
            />

            <div>
              <p className="font-semibold lg:text-lg">可預約時段</p>

              {!monthLoaded ? (
                <div
                  className="mt-3 flex flex-col gap-3"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <Skeleton className="h-12 w-full lg:h-14" />
                  <Skeleton className="h-12 w-full lg:h-14" />
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {visibleSlots.map((slot) => {
                    const startLabel = fmtTime(
                      Math.floor(slot.start.getTime() / 1000)
                    );
                    const endLabel = fmtTime(
                      Math.floor(slot.end.getTime() / 1000)
                    );
                    const reservationBlock = getReservationBlock(slot);
                    const isPast =
                      Math.floor(slot.start.getTime() / 1000) <= nowSec;
                    return (
                      <div
                        key={slot.occurrenceId}
                        {...(isPast
                          ? { 'aria-disabled': true }
                          : {
                              role: 'button',
                              tabIndex: 0,
                              onClick: () => {
                                if (reservationBlock) {
                                  setActiveDialog({
                                    kind: 'prompt',
                                    prompt: reservationBlock,
                                  });
                                  return;
                                }
                                setActiveDialog({
                                  kind: 'edit',
                                  id: slot.id,
                                  occurrenceUnix: slot.occurrenceUnix,
                                });
                              },
                              onKeyDown: (e: KeyboardEvent) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  if (reservationBlock) {
                                    setActiveDialog({
                                      kind: 'prompt',
                                      prompt: reservationBlock,
                                    });
                                    return;
                                  }
                                  setActiveDialog({
                                    kind: 'edit',
                                    id: slot.id,
                                    occurrenceUnix: slot.occurrenceUnix,
                                  });
                                }
                              },
                            })}
                        className={cn(
                          'flex flex-col gap-2 rounded-lg border bg-background p-3 transition-colors lg:p-4',
                          isPast
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        )}
                      >
                        <div className="flex flex-row flex-nowrap items-center justify-between gap-2 lg:gap-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-base font-medium tabular-nums">
                              {startLabel} – {endLabel}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              ({slot.durationMinutes} 分)
                              {isPast ? ' · 已過' : ''}
                            </span>
                          </div>
                          {!isPast && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 lg:h-10 lg:w-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (reservationBlock) {
                                  setActiveDialog({
                                    kind: 'prompt',
                                    prompt: reservationBlock,
                                  });
                                  return;
                                }
                                deleteDraftSlot(slot.id, slot.occurrenceUnix);
                              }}
                            >
                              <X className="h-4 w-4 lg:h-5 lg:w-5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    variant="ghost"
                    onClick={() => setActiveDialog({ kind: 'add' })}
                    className="h-10 w-full lg:h-11 lg:text-base"
                    disabled={!selectedDate}
                  >
                    <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="justify-center gap-3 sm:gap-4 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => {
                resetChanges();
                onOpenChange(false);
              }}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !monthLoaded}>
              {isSaving ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddSlotModal
        open={activeDialog?.kind === 'add'}
        onOpenChange={(open) => !open && setActiveDialog(null)}
        selectedDate={selectedDate}
        existingSlots={futureSlots}
        onSubmit={(form, weekly) => {
          const result = addSlotForSelectedDate({
            startTime: `${form.startHour}:${form.startMinute}`,
            durationMinutes: form.durationMinutes,
            weeklyWithinMonth: weekly,
          });
          setActiveDialog(null);
          if (result.added === 0) {
            toast({
              variant: 'destructive',
              description: '無可用時段(可能與既有時段重疊)',
            });
            return;
          }
          if (result.skipped > 0) {
            toast({
              description: `已新增 ${result.added} 個時段(略過 ${result.skipped} 個重疊時段)`,
            });
          }
        }}
      />

      <EditSlotModal
        slot={editingSlot}
        onClose={() => setActiveDialog(null)}
        onSubmit={(form) => {
          if (activeDialog?.kind !== 'edit') return;
          const ok = updateDraftSlot(
            activeDialog.id,
            activeDialog.occurrenceUnix,
            {
              startTime: `${form.startHour}:${form.startMinute}`,
              durationMinutes: form.durationMinutes,
            }
          );
          if (!ok) {
            toast({
              variant: 'destructive',
              description: '此時段與其他時段重疊',
            });
            return;
          }
          setActiveDialog(null);
        }}
      />

      <Dialog
        open={activeDialog?.kind === 'prompt'}
        onOpenChange={(o) => !o && setActiveDialog(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {lastPrompt === 'BOOKED'
                ? '此時段已有預約'
                : '此時段有未處理的預約申請'}
            </DialogTitle>
            <DialogDescription>
              {lastPrompt === 'BOOKED'
                ? '此時段已有 mentee 預約成功,無法編輯或移除。如需取消,請至「預約管理」頁面處理。'
                : '請至「預約管理」頁面接受或拒絕該申請,僅在拒絕後此時段才會重新釋出。'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-center">
            <Button variant="outline" onClick={() => setActiveDialog(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                setActiveDialog(null);
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

function TimeSelectPair({
  hourValue,
  minuteValue,
  onHourChange,
  onMinuteChange,
}: {
  hourValue: string;
  minuteValue: string;
  onHourChange: (v: string) => void;
  onMinuteChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Select value={hourValue} onValueChange={onHourChange}>
        <SelectTrigger className="h-12 w-24 text-base lg:w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[10rem]">
          {HOUR_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt} className="py-3 text-base">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-base text-muted-foreground">:</span>
      <Select value={minuteValue} onValueChange={onMinuteChange}>
        <SelectTrigger className="h-12 w-24 text-base lg:w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[10rem]">
          {MINUTE_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt} className="py-3 text-base">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DurationRadio({
  value,
  onChange,
}: {
  value: SlotDurationMinutes;
  onChange: (v: SlotDurationMinutes) => void;
}) {
  return (
    <div className="flex gap-2">
      {DURATION_OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 rounded-lg border px-4 py-2 text-base transition-colors',
            value === opt
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input bg-background hover:bg-muted/50'
          )}
        >
          {opt} 分
        </button>
      ))}
    </div>
  );
}

function AddSlotModal({
  open,
  onOpenChange,
  selectedDate,
  existingSlots,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string | null;
  existingSlots: ParsedMentorTimeslot[];
  onSubmit: (form: SlotFormState, weeklyWithinMonth: boolean) => void;
}) {
  const [form, setForm] = useState<SlotFormState>(() =>
    defaultFormForDate(existingSlots)
  );
  const [weekly, setWeekly] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(defaultFormForDate(existingSlots));
      setWeekly(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedDate]);

  const previewDates = useMemo(() => {
    if (!selectedDate || !weekly) return [];
    const dates: string[] = [];
    const startMonth = dayjs(selectedDate).month();
    let cursor = dayjs(selectedDate);
    while (cursor.month() === startMonth) {
      dates.push(cursor.format('M/D'));
      cursor = cursor.add(7, 'day');
    }
    return dates;
  }, [selectedDate, weekly]);

  const weekdayLabel = selectedDate
    ? WEEKDAY_LABELS[dayjs(selectedDate).day()]
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>新增可預約時段</DialogTitle>
          {selectedDate && (
            <DialogDescription>
              {dayjs(selectedDate).format('YYYY/MM/DD')} (週{weekdayLabel})
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
              onMinuteChange={(v) =>
                setForm((f) => ({ ...f, startMinute: snapMinute(parseInt(v)) }))
              }
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
            <p className="text-sm text-muted-foreground">
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

function EditSlotModal({
  slot,
  onClose,
  onSubmit,
}: {
  slot: ParsedMentorTimeslot | null;
  onClose: () => void;
  onSubmit: (form: SlotFormState) => void;
}) {
  const open = slot !== null;
  const [form, setForm] = useState<SlotFormState>({
    startHour: '09',
    startMinute: '00',
    durationMinutes: 30,
  });

  useEffect(() => {
    if (slot) {
      setForm({
        startHour: String(slot.start.getHours()).padStart(2, '0'),
        startMinute: snapMinute(slot.start.getMinutes()),
        durationMinutes: snapDuration(slot.durationMinutes),
      });
    }
  }, [slot]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[400px]">
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
              onMinuteChange={(v) =>
                setForm((f) => ({ ...f, startMinute: snapMinute(parseInt(v)) }))
              }
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
