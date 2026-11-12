import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { NotificationBell } from './NotificationBell';

const meta: Meta<typeof NotificationBell> = {
  title: '佈局元件/Header/NotificationBell',
  component: NotificationBell,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background-bottom flex h-[450px] items-start justify-center p-10">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof NotificationBell>;

const generateNotifications = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${i}`,
    type: 'reservation_requested' as const,
    menteeName: `Mentee ${i}`,
    createdAt: new Date().toISOString(),
    unread: true,
  }));

export const Default: Story = {
  args: {
    initialStatus: 'success',
  },
};

export const UpcomingReservationWithDtstart: Story = {
  args: {
    initialStatus: 'success',
    initialNotifications: [
      {
        id: 'upcoming-dtstart-1',
        type: 'reservation_upcoming',
        mentorName: '陳導師 (Mentor)',
        role: 'mentee',
        dtstart: 1785931200,
        createdAt: new Date().toISOString(),
        unread: true,
      },
      {
        id: 'auto-canceled-system-2',
        type: 'reservation_canceled',
        mentorName: '張大同 (Harrison)',
        role: 'mentee',
        actorRole: 'system',
        createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        unread: true,
      },
    ],
  },
};

export const CanceledReservationByRole: Story = {
  args: {
    initialStatus: 'success',
    initialNotifications: [
      {
        id: 'canceled-mentor-view-1',
        type: 'reservation_canceled',
        menteeName: '林學員 (Mentee)',
        role: 'mentor',
        actorRole: 'mentee',
        createdAt: new Date().toISOString(),
        unread: true,
      },
      {
        id: 'canceled-mentee-view-2',
        type: 'reservation_canceled',
        mentorName: '陳導師 (Mentor)',
        role: 'mentee',
        actorRole: 'mentor',
        createdAt: new Date(Date.now() - 1800 * 1000).toISOString(),
        unread: true,
      },
    ],
  },
};

export const LoadingState: Story = {
  args: {
    initialStatus: 'loading',
  },
};

export const ErrorState: Story = {
  args: {
    initialStatus: 'error',
  },
};

export const EmptyState: Story = {
  args: {
    initialNotifications: [],
    initialStatus: 'empty',
  },
};

export const Over99Notifications: Story = {
  args: {
    initialNotifications: generateNotifications(120),
    initialStatus: 'success',
  },
};

export const LongText: Story = {
  args: {
    initialStatus: 'success',
    initialNotifications: [
      {
        id: 'long-1',
        type: 'reservation_requested',
        menteeName: '超級長長長長長長長長長長長長長長長長長名字使用者',
        createdAt: new Date().toISOString(),
        unread: true,
      },
    ],
  },
};

export const FeedbackReceivedNotification: Story = {
  args: {
    initialStatus: 'success',
    initialNotifications: [
      {
        id: 'feedback-received-1',
        type: 'reservation_feedback_received',
        role: 'mentor',
        menteeName: '王小明',
        reservationId: '501',
        createdAt: new Date(Date.now() - 300 * 1000).toISOString(),
        unread: true,
      },
    ],
  },
};
