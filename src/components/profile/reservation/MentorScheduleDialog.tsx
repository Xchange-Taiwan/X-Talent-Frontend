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
import { Input } from '@/components/ui/input';
import { UseMentorScheduleReturn } from '@/hooks/useMentorSchedule';

import { ScheduleCalendar } from './ScheduleCalendar';

type EditingSlot = {
  id: number;
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
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
  } = schedule;

  const [isSaving, setIsSaving] = useState(false);
  const [editingSlots, setEditingSlots] = useState<EditingSlot[]>([]);

  useEffect(() => {
    const newEditingSlots = draftForSelectedDate.map((slot) => ({
      id: slot.id,
      startHour: String(slot.start.getHours()).padStart(2, '0'),
      startMinute: String(slot.start.getMinutes()).padStart(2, '0'),
      endHour: String(slot.end.getHours()).padStart(2, '0'),
      endMinute: String(slot.end.getMinutes()).padStart(2, '0'),
    }));
    setEditingSlots(newEditingSlots);
  }, [draftForSelectedDate]);

  const allowedDates = parsedDraft
    .filter((slot) => slot.type === 'ALLOW')
    .map((slot) => slot.dateKey);

  const handleSave = async () => {
    setIsSaving(true);
    await confirmChanges();
    setIsSaving(false);
    onOpenChange(false);
  };

  const handleLocalTimeChange = (
    id: number,
    part: keyof Omit<EditingSlot, 'id'>,
    value: string
  ) => {
    setEditingSlots((currentSlots) =>
      currentSlots.map((slot) =>
        slot.id === id ? { ...slot, [part]: value } : slot
      )
    );
  };

  const handleTimeBlur = (
    id: number,
    part: keyof Omit<EditingSlot, 'id'>,
    value: string
  ) => {
    const numericValue = parseInt(value, 10);
    const clampedValue = isNaN(numericValue) ? 0 : numericValue;
    const formattedValue = String(clampedValue).padStart(2, '0');

    handleLocalTimeChange(id, part, formattedValue);

    const originalSlot = editingSlots.find((s) => s.id === id);
    if (!originalSlot) return;

    const updatedSlot = { ...originalSlot, [part]: formattedValue };
    const newStartTime = `${updatedSlot.startHour}:${updatedSlot.startMinute}`;
    const newEndTime = `${updatedSlot.endHour}:${updatedSlot.endMinute}`;

    updateDraftSlot(id, {
      startTime: newStartTime,
      endTime: newEndTime,
    });
  };

  const addNewTimeSlot = () => {
    addSlotForSelectedDate({
      type: 'ALLOW',
      startTime: '09:00',
      endTime: '10:00',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Scheduling Setting</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div>
            <ScheduleCalendar
              selected={selectedDate ? new Date(selectedDate) : new Date()}
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
              highlightAvailableDates={true}
            />
          </div>
          <div>
            <p className="font-semibold">Available time slots</p>
            <div className="mt-4 flex flex-col gap-4">
              {editingSlots.map((slot, index) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-nowrap items-center gap-1">
                    <Input
                      type="number"
                      value={slot.startHour}
                      onChange={(e) =>
                        handleLocalTimeChange(
                          slot.id,
                          'startHour',
                          e.target.value
                        )
                      }
                      onBlur={(e) =>
                        handleTimeBlur(slot.id, 'startHour', e.target.value)
                      }
                      className="w-14 text-center"
                    />
                    <span>:</span>
                    <Input
                      type="number"
                      value={slot.startMinute}
                      onChange={(e) =>
                        handleLocalTimeChange(
                          slot.id,
                          'startMinute',
                          e.target.value
                        )
                      }
                      onBlur={(e) =>
                        handleTimeBlur(slot.id, 'startMinute', e.target.value)
                      }
                      className="w-14 text-center"
                    />
                    <span className="mx-1">~</span>
                    <Input
                      type="number"
                      value={slot.endHour}
                      onChange={(e) =>
                        handleLocalTimeChange(
                          slot.id,
                          'endHour',
                          e.target.value
                        )
                      }
                      onBlur={(e) =>
                        handleTimeBlur(slot.id, 'endHour', e.target.value)
                      }
                      className="w-14 text-center"
                    />
                    <span>:</span>
                    <Input
                      type="number"
                      value={slot.endMinute}
                      onChange={(e) =>
                        handleLocalTimeChange(
                          slot.id,
                          'endMinute',
                          e.target.value
                        )
                      }
                      onBlur={(e) =>
                        handleTimeBlur(slot.id, 'endMinute', e.target.value)
                      }
                      className="w-14 text-center"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => deleteDraftSlot(slot.id!)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-shrink-0 items-center">
                    {index === editingSlots.length - 1 ? (
                      <Button variant="ghost" onClick={addNewTimeSlot}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="w-10" />
                    )}
                  </div>
                </div>
              ))}
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
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
