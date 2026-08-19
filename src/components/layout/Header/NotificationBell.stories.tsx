import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { NotificationBell } from './NotificationBell';

const meta: Meta<typeof NotificationBell> = {
  title: '佈局元件/Header/NotificationBell',
  component: NotificationBell,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="flex h-[450px] items-start justify-center bg-background-bottom p-10">
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
