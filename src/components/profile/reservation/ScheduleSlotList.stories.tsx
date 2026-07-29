import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { BookingSlot } from '@/hooks/useMentorSchedule';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';

import { BOOKED_SLOT_CLASSES, ScheduleSlotList } from './ScheduleSlotList';

const meta: Meta<typeof ScheduleSlotList> = {
  title: 'Components/Profile/Reservation/ScheduleSlotList',
  component: ScheduleSlotList,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ScheduleSlotList>;

const now = new Date();

// Helper to create dates relative to now
const relativeDate = (hoursOffset: number, minutesOffset: number = 0) => {
  const d = new Date(now);
  d.setHours(d.getHours() + hoursOffset, minutesOffset, 0, 0);
  return d;
};

const mockSlots: BookingSlot[] = [
  {
    start: relativeDate(2), // 2 hours in future
    end: relativeDate(2, 30),
    scheduleId: 101,
    isBooked: false,
  },
  {
    start: relativeDate(3), // 3 hours in future
    end: relativeDate(3, 45),
    scheduleId: 102,
    isBooked: true,
  },
];

const defaultRenderSlot = (slot: BookingSlot) => (
  <Button
    type="button"
    variant={slot.isBooked ? 'ghost' : 'outline'}
    disabled={slot.isBooked}
    className={`h-10 w-full text-sm ${slot.isBooked ? BOOKED_SLOT_CLASSES : ''}`}
  >
    {formatBookingSlotTime(slot)}
  </Button>
);

export const Loading: Story = {
  args: {
    slots: [],
    monthLoaded: false,
    renderSlot: defaultRenderSlot,
  },
};

export const Empty: Story = {
  args: {
    slots: [],
    monthLoaded: true,
    renderSlot: defaultRenderSlot,
  },
};

export const WithSlots: Story = {
  args: {
    slots: mockSlots,
    monthLoaded: true,
    renderSlot: defaultRenderSlot,
  },
};
