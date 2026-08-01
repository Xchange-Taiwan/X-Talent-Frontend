import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { BookingSlot } from '@/hooks/useMentorSchedule';
import { formatBookingSlotTime } from '@/lib/profile/scheduleFormatters';

import { mockBookingSlots } from './__mocks__/reservationStories.mock';
import { BOOKED_SLOT_CLASSES, ScheduleSlotList } from './ScheduleSlotList';

const meta: Meta<typeof ScheduleSlotList> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/ScheduleSlotList',
  component: ScheduleSlotList,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ScheduleSlotList>;

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
    slots: mockBookingSlots,
    monthLoaded: true,
    renderSlot: defaultRenderSlot,
  },
};
