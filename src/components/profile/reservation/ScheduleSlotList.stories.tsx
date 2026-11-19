import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockBookingSlots } from './__mocks__/reservationStories.mock';
import { ScheduleSlotList } from './ScheduleSlotList';

const meta: Meta<typeof ScheduleSlotList> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/ScheduleSlotList',
  component: ScheduleSlotList,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ScheduleSlotList>;

export const Loading: Story = {
  args: {
    mode: 'interactive',
    slots: [],
    monthLoaded: false,
    onSelectSlot: () => {},
  },
};

export const Empty: Story = {
  args: {
    mode: 'interactive',
    slots: [],
    monthLoaded: true,
    onSelectSlot: () => {},
  },
};

export const WithSlots: Story = {
  args: {
    mode: 'interactive',
    slots: mockBookingSlots,
    monthLoaded: true,
    selectedSlot: mockBookingSlots[0],
    onSelectSlot: () => {},
    mentorId: '7482008160728084',
  },
};

export const ReadOnlyPreview: Story = {
  args: {
    mode: 'readonly',
    slots: mockBookingSlots.filter(
      (slot) => !slot.isBooked && slot.status === null
    ),
    monthLoaded: true,
  },
};
