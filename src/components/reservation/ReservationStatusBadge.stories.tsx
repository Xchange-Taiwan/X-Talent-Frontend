import type { Meta, StoryObj } from '@storybook/nextjs';

import { ReservationStatusBadge } from './ReservationStatusBadge';

const meta: Meta<typeof ReservationStatusBadge> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationStatusBadge',
  component: ReservationStatusBadge,
  tags: ['autodocs'],
  argTypes: {
    dtstart: {
      control: 'number',
      description: '預約開始時間 (Unix 紀元秒數)',
    },
    dtend: {
      control: 'number',
      description: '預約結束時間 (Unix 紀元秒數)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReservationStatusBadge>;

// 1. PENDING State: Represented by a reservation scheduled in the future (far countdown)
export const Pending: Story = {
  args: {
    // 3 days in the future
    dtstart: Math.floor(Date.now() / 1000) + 3 * 24 * 3600,
    dtend: Math.floor(Date.now() / 1000) + 3 * 24 * 3600 + 3600,
  },
};

// 2. ACCEPT State: Represented by an active, accepted live session
export const Accept: Story = {
  args: {
    // Started 10 minutes ago, ends in 50 minutes
    dtstart: Math.floor(Date.now() / 1000) - 10 * 60,
    dtend: Math.floor(Date.now() / 1000) + 50 * 60,
  },
};

// 3. REJECT State: Represented by a past/ended reservation
export const Reject: Story = {
  args: {
    // 2 days in the past
    dtstart: Math.floor(Date.now() / 1000) - 2 * 24 * 3600,
    dtend: Math.floor(Date.now() / 1000) - 2 * 24 * 3600 + 3600,
  },
};

// 4. Imminent Countdown (upcoming accepted session starting very soon)
export const Imminent: Story = {
  args: {
    // Starts in 5 minutes
    dtstart: Math.floor(Date.now() / 1000) + 5 * 60,
    dtend: Math.floor(Date.now() / 1000) + 65 * 60,
  },
};

// 5. Soon Countdown (upcoming accepted session starting in a few hours)
export const Soon: Story = {
  args: {
    // Starts in 2 hours
    dtstart: Math.floor(Date.now() / 1000) + 2 * 3600,
    dtend: Math.floor(Date.now() / 1000) + 3 * 3600,
  },
};
