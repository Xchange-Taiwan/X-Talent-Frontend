'use client';

import { Clock, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import type {
  BookingCalendarReader,
  BookingStatus,
  EditorSlotWithMeta,
  MentorScheduleEditor,
} from '@/lib/profile/bookingAvailability';
import { fmtTime, toDateKey } from '@/lib/profile/scheduleFormatters';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';

import { AddSlotModal } from './AddSlotModal';
import { EditSlotModal } from './EditSlotModal';
import { ReservationBlockPromptDialog } from './ReservationBlockPromptDialog';
import { ScheduleCalendar } from './ScheduleCalendar';

type ActiveDialog =
  | { kind: 'add' }
  | { kind: 'edit'; id: number; occurrenceUnix: number }
  | {
      kind: 'prompt';
      prompt: BookingStatus;
      matchedReservation?: Reservation;
    }
  | null;

export default function MentorScheduleDialog({
  open,
  onOpenChange,
  reader,
  schedule,
  onMonthChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Calendar navigation (selected date, allowed dates, month-loaded gating,
   * reload/error) - shared with the mentee/visitor view rather than
   * re-declared on `schedule` below. See `BookingCalendarReader` /
   * `MentorScheduleEditor` in src/lib/profile/bookingAvailability/types.ts.
   */
  reader: BookingCalendarReader;
  schedule: MentorScheduleEditor;
  onMonthChange?: (date: Date) => void;
}) {
  const { selectedDate, setSelectedDate, allowedDates } = reader;
  const { monthLoaded } = reader.slotsSnapshot;
  const {
    slotsWithMeta,
    futureSlots,
    addSlotForSelectedDate,
    deleteDraftSlot,
    confirmChanges,
    resetChanges,
    updateDraftSlot,
  } = schedule;

  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);

  const showPrompt = (
    prompt: BookingStatus,
    matchedReservation?: Reservation
  ) => {
    setActiveDialog({ kind: 'prompt', prompt, matchedReservation });
  };

  const handleSlotAction = (item: EditorSlotWithMeta) => {
    if (item.reservationBlock) {
      showPrompt(item.reservationBlock, item.matchedReservation);
      return;
    }
    setActiveDialog({
      kind: 'edit',
      id: item.slot.id,
      occurrenceUnix: item.slot.occurrenceUnix,
    });
  };

  useEffect(() => {
    if (open) {
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: 'mentor_schedule' },
      });
    }
  }, [open]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await confirmChanges();
      if (!result.ok) {
        toast({
          variant: 'destructive',
          description:
            result.reason === 'conflict'
              ? '此時段與既有預約衝突,請新增新時段後再試'
              : '儲存失敗,請稍後再試',
        });
        return;
      }
      onOpenChange(false);
    } catch {
      toast({
        variant: 'destructive',
        description: '儲存失敗,請稍後再試',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const editingSlot =
    activeDialog?.kind === 'edit'
      ? (slotsWithMeta.find(
          (item) =>
            item.slot.id === activeDialog.id &&
            item.slot.occurrenceUnix === activeDialog.occurrenceUnix
        )?.slot ?? null)
      : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[85dvh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-[440px] lg:max-w-[560px]"
        >
          <DialogHeader>
            <DialogTitle>設定可預約時段</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <ScheduleCalendar
              selected={
                selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()
              }
              month={
                reader.year && reader.month
                  ? new Date(reader.year, reader.month - 1, 1)
                  : undefined
              }
              onSelect={(d) => setSelectedDate(d ? toDateKey(d) : null)}
              onMonthChange={
                onMonthChange ??
                ((d) =>
                  reader.onMonthChange?.(d, { preserveSelectedDate: true }))
              }
              allowedDates={allowedDates}
              showTodayStyle={false}
              disableEmptyDates={false}
              disablePastDates={true}
              highlightAvailableDates={true}
              isMonthLoading={!monthLoaded}
              hasError={reader.hasError}
              onRetry={reader.reload}
            />

            {!reader.hasError && (
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
                    {slotsWithMeta.map((item) => {
                      const { slot, isPast, reservationBlock } = item;
                      const startLabel = fmtTime(
                        Math.floor(slot.start.getTime() / 1000)
                      );
                      const endLabel = fmtTime(
                        Math.floor(slot.end.getTime() / 1000)
                      );
                      return (
                        <div
                          key={slot.occurrenceId}
                          {...(isPast
                            ? { 'aria-disabled': true }
                            : {
                                role: 'button',
                                tabIndex: 0,
                                onClick: () => handleSlotAction(item),
                                onKeyDown: (e: KeyboardEvent) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleSlotAction(item);
                                  }
                                },
                              })}
                          className={cn(
                            'bg-background-white flex flex-col gap-2 rounded-lg border p-3 transition-colors lg:p-4',
                            isPast
                              ? 'cursor-not-allowed opacity-50'
                              : cn(
                                  'hover:bg-background-bottom/50 cursor-pointer focus-visible:outline-none',
                                  FOCUS_RING_CLASSES
                                )
                          )}
                        >
                          <div className="flex flex-row flex-nowrap items-center justify-between gap-2 lg:gap-3">
                            <div className="flex items-center gap-2">
                              <Clock className="text-text-tertiary size-4" />
                              <span className="text-base font-medium tabular-nums">
                                {startLabel} – {endLabel}
                              </span>
                              <span className="text-text-tertiary text-sm">
                                ({slot.durationMinutes} 分)
                                {isPast ? ' · 已過' : ''}
                              </span>
                            </div>
                            {!isPast && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 lg:size-10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (reservationBlock) {
                                    showPrompt(
                                      reservationBlock,
                                      item.matchedReservation
                                    );
                                    return;
                                  }
                                  deleteDraftSlot(slot.id, slot.occurrenceUnix);
                                }}
                              >
                                <X className="size-4 lg:size-5" />
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
                      <Plus className="size-4 lg:size-5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="justify-center gap-3 sm:gap-4 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => {
                resetChanges();
                onOpenChange(false);
              }}
            >
              {!reader.hasError ? '取消' : '關閉'}
            </Button>
            {!reader.hasError && (
              <Button onClick={handleSave} disabled={isSaving || !monthLoaded}>
                {isSaving ? '儲存中...' : '儲存'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddSlotModal
        open={activeDialog?.kind === 'add'}
        onOpenChange={(nextOpen) => !nextOpen && setActiveDialog(null)}
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
        open={activeDialog?.kind === 'edit'}
        slot={editingSlot}
        onClose={() => setActiveDialog(null)}
        onSubmit={(form) => {
          if (activeDialog?.kind !== 'edit') return;
          const result = updateDraftSlot(
            activeDialog.id,
            activeDialog.occurrenceUnix,
            {
              startTime: `${form.startHour}:${form.startMinute}`,
              durationMinutes: form.durationMinutes,
            }
          );
          if (!result.success) {
            if (result.reason === 'TARGET_MONTH_NOT_LOADED') {
              toast({
                variant: 'destructive',
                description:
                  '目標月份排程尚未載入，請先在行事曆中切換至目標月份。',
              });
            } else if (result.reason === 'OVERLAP') {
              toast({
                variant: 'destructive',
                description: '此時段與其他時段重疊',
              });
            } else if (result.reason === 'READ_ONLY') {
              toast({
                variant: 'destructive',
                description: '此時段已被預約引用，無法編輯，請改為新增新時段',
              });
            } else {
              toast({
                variant: 'destructive',
                description: '更新時段失敗，發生未知的錯誤，請稍後再試。',
              });
            }
            return;
          }
          setActiveDialog(null);
        }}
      />

      <ReservationBlockPromptDialog
        open={activeDialog?.kind === 'prompt'}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setActiveDialog(null);
        }}
        promptType={
          activeDialog?.kind === 'prompt' ? activeDialog.prompt : 'BOOKED'
        }
        matchedReservation={
          activeDialog?.kind === 'prompt'
            ? activeDialog.matchedReservation
            : undefined
        }
        onNavigateToReservations={() => {
          setActiveDialog(null);
          onOpenChange(false);
          router.push('/reservation/mentor');
        }}
      />
    </>
  );
}
