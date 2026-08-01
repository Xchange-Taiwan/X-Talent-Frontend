import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { mockReservation } from './mocks';
import { ReservationCard } from './ReservationCard';

const meta: Meta<typeof ReservationCard> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationCard',
  component: ReservationCard,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['pending', 'upcoming', 'history'],
      description: '卡片的狀態標籤類別變體',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReservationCard>;

// 1. PENDING State: Card variant is 'pending', awaiting reply. Mentor actions (Accept / Reject) are shown.
export const Pending: Story = {
  args: {
    variant: 'pending',
    item: {
      ...mockReservation,
      // Status is conceptually pending, so starting in 3 days
    },
    actions: (
      <div className="flex gap-2">
        <Button variant="outline" size="sm">
          拒絕
        </Button>
        <Button
          variant="default"
          size="sm"
          className="bg-brand-500 hover:bg-brand-600"
        >
          接受
        </Button>
      </div>
    ),
  },
};

// 2. ACCEPT State: Card variant is 'upcoming', session is confirmed and countdown is live/soon.
export const Accept: Story = {
  args: {
    variant: 'upcoming',
    item: {
      ...mockReservation,
      // Accepted, starts in 45 minutes (Soon countdown)
      dtstart: Math.floor(Date.now() / 1000) + 45 * 60,
      dtend: Math.floor(Date.now() / 1000) + 105 * 60,
      mentorMessage: {
        content:
          '王小明你好！很高興收到你的諮詢邀請。這兩個主題都非常實用。建議你在對談前可以先準備一兩個具體遇到的 Bottleneck 案例或程式碼片段，我們當天可以直接針對實際場景進行 Code Review，這樣對你幫助最大。期待週三晚上聊聊！',
        role: 'MENTOR',
      },
    },
    actions: (
      <Button variant="outline" size="sm">
        取消預約
      </Button>
    ),
  },
};

// 3. REJECT State: Card variant is 'history', reservation was rejected or cancelled.
export const Reject: Story = {
  args: {
    variant: 'history',
    item: {
      ...mockReservation,
      // Ended or rejected in the past
      dtstart: Math.floor(Date.now() / 1000) - 2 * 24 * 3600,
      dtend: Math.floor(Date.now() / 1000) - 2 * 24 * 3600 + 3600,
      cancelledBy: 'MENTOR',
    },
    actions: (
      <Badge variant="secondary" className="px-2 py-1 text-xs">
        已由導師取消
      </Badge>
    ),
  },
};
