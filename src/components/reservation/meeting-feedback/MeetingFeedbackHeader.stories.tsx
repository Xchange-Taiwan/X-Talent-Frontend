import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { mockReservation } from '@/components/reservation/mocks';

import { MeetingFeedbackHeader } from './MeetingFeedbackHeader';

const queueReservations = [
  {
    ...mockReservation,
    id: 'hdr-queue-1',
    name: 'Emily Chen',
    date: '2026/10/12',
    time: '19:00–19:30',
  },
  {
    ...mockReservation,
    id: 'hdr-queue-2',
    name: 'Alex Wang',
    date: '2026/10/15',
    time: '20:00–20:30',
  },
  {
    ...mockReservation,
    id: 'hdr-queue-3',
    name: 'Zahra Mirzakhani',
    date: '2026/10/18',
    time: '21:00–21:30',
  },
];

const meta: Meta<typeof MeetingFeedbackHeader> = {
  title: '業務模組元件/預約管理(Reservation)/MeetingFeedbackHeader',
  component: MeetingFeedbackHeader,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="border-background-border bg-background-white mx-auto max-w-[468px] rounded-lg border pb-4">
        <Story />
      </div>
    ),
  ],
  args: {
    activeReservation: queueReservations[0]!,
    queueItems: [queueReservations[0]!],
    queueIndex: 0,
    isQueueMode: false,
    isMentor: false,
    isSubmitting: false,
    isTransitioningCard: false,
    tooltipDismissSignal: 0,
    onSkipTooltipOpenChange: () => {},
    onCloseOrSkipClick: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof MeetingFeedbackHeader>;

export const SingleMenteeSession: Story = {};

export const SingleMentorConfirmSession: Story = {
  args: {
    isMentor: true,
  },
};

export const MultiSessionQueueMiddleCard: Story = {
  args: {
    activeReservation: queueReservations[1]!,
    queueItems: queueReservations,
    queueIndex: 1,
    isQueueMode: true,
  },
};

export const EmptyAvatarInitialsFallback: Story = {
  args: {
    activeReservation: {
      ...queueReservations[0]!,
      avatar: undefined,
    },
  },
};
