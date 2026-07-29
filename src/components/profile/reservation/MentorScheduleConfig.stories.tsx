import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockBookingSlots } from './__mocks__/reservationStories.mock';
import { MentorScheduleConfig } from './MentorScheduleConfig';

const meta: Meta<typeof MentorScheduleConfig> = {
  title: 'Components/Profile/Reservation/MentorScheduleConfig',
  component: MentorScheduleConfig,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MentorScheduleConfig>;

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
    slots: mockBookingSlots,
    monthLoaded: true,
    onReservation: () => alert('設定預約被點擊'),
  },
};
