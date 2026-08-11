import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { NotificationBell } from './NotificationBell';

const meta: Meta<typeof NotificationBell> = {
  title: '佈局元件/Header/NotificationBell',
  component: NotificationBell,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="flex h-[150px] items-center justify-center bg-background-bottom p-10">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof NotificationBell>;

export const Default: Story = {
  args: {
    unreadCount: 5,
  },
};

export const Over99Notifications: Story = {
  args: {
    unreadCount: 120,
  },
};

export const NoNotifications: Story = {
  args: {
    unreadCount: 0,
  },
};
