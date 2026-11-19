import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import {
  createInMemoryNotificationSource,
  type NotificationItem,
  type NotificationSource,
  type NotificationStatus,
} from '@/lib/notifications';

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

const defaultStoryNotifications: NotificationItem[] = [
  {
    id: 'default-1',
    type: 'reservation_requested',
    menteeName: '林學員 (Mentee)',
    role: 'mentor',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    unread: true,
  },
  {
    id: 'default-2',
    type: 'reservation_success',
    mentorName: '陳導師 (Mentor)',
    role: 'mentee',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    unread: true,
  },
  {
    id: 'default-3',
    type: 'feedback_received',
    menteeName: '王小明',
    role: 'mentor',
    reservationId: '201',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    unread: false,
  },
];

const loadingStorySource: NotificationSource = {
  requiresAuth: false,
  isPreloaded: false,
  getUnreadCount: () => new Promise(() => {}),
  listNotifications: () => new Promise(() => {}),
  markOneRead: async () => {},
  markAllRead: async () => {},
};

function createErrorStorySource(
  fallbackItems: NotificationItem[]
): NotificationSource {
  let recoveredItems = fallbackItems.map((item) => ({ ...item }));
  return {
    requiresAuth: false,
    isPreloaded: false,
    async getUnreadCount() {
      return {
        unread_count: recoveredItems.filter((item) => item.unread).length,
      };
    },
    async listNotifications() {
      throw new Error('Simulated notification load failure');
    },
    async markOneRead(_userId: string, notificationId: string) {
      recoveredItems = recoveredItems.map((item) =>
        item.id === notificationId ? { ...item, unread: false } : item
      );
    },
    async markAllRead() {
      recoveredItems = recoveredItems.map((item) => ({
        ...item,
        unread: false,
      }));
    },
    async retry() {
      return recoveredItems.map((item) => ({ ...item }));
    },
  };
}

function buildDeterministicStoryArgs(
  userId: string,
  items: NotificationItem[],
  initialStatus: NotificationStatus = items.length === 0 ? 'empty' : 'success'
) {
  return {
    userId,
    initialStatus,
    initialNotifications: items,
    notificationSource: createInMemoryNotificationSource(items, {
      requiresAuth: false,
      isPreloaded: true,
    }),
  };
}

const generateNotifications = (count: number): NotificationItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${i}`,
    type: 'reservation_requested',
    menteeName: `Mentee ${i}`,
    createdAt: new Date().toISOString(),
    unread: true,
  }));

export const Default: Story = {
  args: {
    userId: 'story-default',
    notificationSource: createInMemoryNotificationSource(
      defaultStoryNotifications,
      { requiresAuth: false }
    ),
  },
};

export const UpcomingReservationWithDtstart: Story = {
  args: buildDeterministicStoryArgs('story-upcoming-dtstart', [
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
  ]),
};

export const CanceledReservationByRole: Story = {
  args: buildDeterministicStoryArgs('story-canceled-by-role', [
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
  ]),
};

export const LoadingState: Story = {
  args: {
    userId: 'story-loading',
    initialStatus: 'loading',
    notificationSource: loadingStorySource,
  },
};

export const ErrorState: Story = {
  args: {
    userId: 'story-error',
    initialStatus: 'error',
    notificationSource: createErrorStorySource(defaultStoryNotifications),
  },
};

export const EmptyState: Story = {
  args: buildDeterministicStoryArgs('story-empty', [], 'empty'),
};

export const Over99Notifications: Story = {
  args: buildDeterministicStoryArgs(
    'story-over-99',
    generateNotifications(120),
    'success'
  ),
};

export const LongText: Story = {
  args: buildDeterministicStoryArgs('story-long-text', [
    {
      id: 'long-1',
      type: 'reservation_requested',
      menteeName: '超級長長長長長長長長長長長長長長長長長名字使用者',
      createdAt: new Date().toISOString(),
      unread: true,
    },
  ]),
};

export const FeedbackReminderByRole: Story = {
  args: buildDeterministicStoryArgs('story-feedback-reminder', [
    {
      id: 'feedback-mentor-1',
      type: 'feedback_reminder',
      role: 'mentor',
      menteeName: '林學員',
      reservationId: '201',
      createdAt: new Date().toISOString(),
      unread: true,
    },
    {
      id: 'feedback-mentee-2',
      type: 'feedback_reminder',
      role: 'mentee',
      mentorName: 'Emily Chen',
      reservationId: '101',
      createdAt: new Date().toISOString(),
      unread: true,
    },
  ]),
};

export const FeedbackReceivedForMentor: Story = {
  args: buildDeterministicStoryArgs('story-feedback-received', [
    {
      id: 'feedback-received-mentor-1',
      type: 'feedback_received',
      role: 'mentor',
      menteeName: 'Zahra Mirzakhani',
      reservationId: '201',
      createdAt: new Date().toISOString(),
      unread: true,
    },
    {
      id: 'feedback-received-mentor-2',
      type: 'feedback_received',
      role: 'mentor',
      menteeName: '王小明',
      reservationId: '202',
      createdAt: new Date(Date.now() - 1800 * 1000).toISOString(),
      unread: false,
    },
  ]),
};

export const OfficialFeedbackNotificationTypes: Story = {
  args: buildDeterministicStoryArgs('story-official-feedback-types', [
    {
      id: 'official-feedback-requested-1',
      type: 'reservation_feedback_requested',
      role: 'mentee',
      mentorName: 'Emily Chen',
      reservationId: '101',
      createdAt: new Date().toISOString(),
      unread: true,
    },
    {
      id: 'official-attendance-requested-2',
      type: 'reservation_attendance_requested',
      role: 'mentor',
      menteeName: '林學員',
      reservationId: '205',
      createdAt: new Date(Date.now() - 900 * 1000).toISOString(),
      unread: true,
    },
    {
      id: 'official-feedback-received-3',
      type: 'reservation_feedback_received',
      role: 'mentor',
      menteeName: 'Zahra Mirzakhani',
      reservationId: '201',
      createdAt: new Date(Date.now() - 1800 * 1000).toISOString(),
      unread: false,
    },
  ]),
};

/**
 * Portal 內通知項目預設包覆 `data-clarity-mask="true"`，確保導師／學員真實姓名不外洩至 Clarity 錄影 (#950)。
 */
export const ClarityMaskedUnreadNames: Story = {
  args: buildDeterministicStoryArgs('clarity-mask-demo', [
    {
      id: 'clarity-mask-1',
      type: 'reservation_requested',
      role: 'mentor',
      menteeName: '王小明',
      reservationId: '301',
      createdAt: new Date().toISOString(),
      unread: true,
    },
  ]),
};
