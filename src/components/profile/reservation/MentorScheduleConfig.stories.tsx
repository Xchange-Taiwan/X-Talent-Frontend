import type { Meta, StoryObj } from '@storybook/nextjs';

import { MentorScheduleConfig } from './MentorScheduleConfig';

const meta: Meta<typeof MentorScheduleConfig> = {
  title: 'Components/Profile/Reservation/MentorScheduleConfig',
  component: MentorScheduleConfig,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MentorScheduleConfig>;

const now = new Date();

// Helper to create dates relative to now
const relativeDate = (hoursOffset: number, minutesOffset: number = 0) => {
  const d = new Date(now);
  d.setHours(d.getHours() + hoursOffset, minutesOffset, 0, 0);
  return d;
};

const mockSlots = [
  {
    start: relativeDate(1), // 1 hour in future
    end: relativeDate(1, 30),
    scheduleId: 201,
    isBooked: false,
  },
  {
    start: relativeDate(2), // 2 hours in future
    end: relativeDate(2, 30),
    scheduleId: 202,
    isBooked: true,
  },
];

export const Loading: Story = {
  args: {
    slots: [],
    monthLoaded: false,
    onReservation: () => alert('設定預約被點擊'),
  },
};

export const Empty: Story = {
  args: {
    slots: [],
    monthLoaded: true,
    onReservation: () => alert('設定預約被點擊'),
  },
};

export const WithSlots: Story = {
  args: {
    slots: mockSlots,
    monthLoaded: true,
    onReservation: () => alert('設定預約被點擊'),
  },
};
