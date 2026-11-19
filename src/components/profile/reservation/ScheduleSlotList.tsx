'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import type { BookingSlot } from '@/lib/profile/bookingAvailability';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';
import { isSlotTaken } from '@/lib/profile/scheduleHelpers';
import { cn } from '@/lib/utils';

export type ScheduleSlotListMode = 'interactive' | 'readonly';

export interface ScheduleSlotListProps {
  slots: BookingSlot[];
  monthLoaded: boolean;
  mode?: ScheduleSlotListMode;
  selectedSlot?: BookingSlot | null;
  onSelectSlot?: (slot: BookingSlot) => void;
  mentorId?: string;
  renderSlot?: (slot: BookingSlot) => React.ReactNode;
}

export const BOOKED_SLOT_CLASSES =
  'cursor-not-allowed border-background-border bg-background-bottom text-text-disable disabled:opacity-100';

export function ScheduleSlotList({
  slots,
  monthLoaded,
  mode,
  selectedSlot,
  onSelectSlot,
  mentorId,
  renderSlot,
}: ScheduleSlotListProps) {
  const effectiveMode: ScheduleSlotListMode =
    mode ?? (onSelectSlot || renderSlot ? 'interactive' : 'readonly');
  const isReadOnly = effectiveMode === 'readonly';

  const renderSlotItem = (slot: BookingSlot) => {
    if (renderSlot) {
      return renderSlot(slot);
    }

    if (isReadOnly) {
      return (
        <div className="border-background-border flex h-10 items-center justify-center rounded-lg border text-sm font-medium select-none">
          {formatBookingSlotTime(slot)}
        </div>
      );
    }

    const isSelected = selectedSlot?.start.getTime() === slot.start.getTime();
    const taken = isSlotTaken(slot);

    return (
      <Button
        type="button"
        variant={isSelected ? 'default' : 'outline'}
        disabled={taken}
        onClick={() => onSelectSlot?.(slot)}
        data-analytics-click="profile_booking_slot_select"
        data-analytics-feature="reservation"
        data-analytics-location="profile_booking_card"
        {...(mentorId ? { 'data-analytics-param-mentor-id': mentorId } : {})}
        className={cn('h-10 w-full text-sm', taken && BOOKED_SLOT_CLASSES)}
      >
        {formatBookingSlotTime(slot)}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        'flex w-full flex-col items-start',
        isReadOnly ? 'gap-3' : 'gap-4'
      )}
    >
      <p
        className={
          isReadOnly ? 'text-text-primary text-sm font-semibold' : undefined
        }
      >
        當日可預約時段
      </p>
      {!monthLoaded ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className={cn(
            'text-text-disable flex min-h-10 items-center',
            isReadOnly && 'text-sm'
          )}
        >
          讀取中…
        </div>
      ) : slots.length === 0 ? (
        <div
          className={cn(
            'text-text-disable flex min-h-10 items-center',
            isReadOnly && 'text-sm'
          )}
        >
          無可預約的時段
        </div>
      ) : (
        <div className="grid w-full grid-cols-2 gap-2">
          {slots.map((slot) => (
            <React.Fragment key={`${slot.scheduleId}_${slot.start.getTime()}`}>
              {renderSlotItem(slot)}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
