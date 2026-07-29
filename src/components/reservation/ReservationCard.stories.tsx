import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { ReservationCard } from './ReservationCard';
import type { Reservation } from './types';

const meta: Meta<typeof ReservationCard> = {
  title: 'Components/Reservation/ReservationCard',
  component: ReservationCard,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['pending', 'upcoming', 'history'],
      description: 'The status tab category variant of the card',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReservationCard>;

// Standard mock base for a reservation
const baseReservation: Reservation = {
  id: 'res-415',
  name: '王小明 (Alvin Wang)',
  roleLine: 'Google 台灣 Senior Frontend Engineer / 前端架構專家',
  date: '2026年8月5日 (星期三)',
  time: '20:00 – 21:00',
  messages: [
    {
      content:
        '嗨！我想向您諮詢關於大型 React 專案在 Next.js App Router 架構底下的元件拆分，以及效能瓶頸（RSC vs Client Component）的實戰優化建議。另外也想了解在跨國外商的升遷機制與面試準備重點，謝謝導師！',
      role: 'MENTEE',
    },
  ],
  menteeMessage: {
    content:
      '嗨！我想向您諮詢關於大型 React 專案在 Next.js App Router 架構底下的元件拆分，以及效能瓶頸（RSC vs Client Component）的實戰優化建議。另外也想了解在跨國外商的升遷機制與面試準備重點，謝謝導師！',
    role: 'MENTEE',
  },
  scheduleId: 101,
  dtstart: Math.floor(Date.now() / 1000) + 3 * 24 * 3600, // 3 days in future
  dtend: Math.floor(Date.now() / 1000) + 3 * 24 * 3600 + 3600,
  senderUserId: 'user-mentee-111',
  participantUserId: 'user-mentor-222',
};

// 1. PENDING State: Card variant is 'pending', awaiting reply. Mentor actions (Accept / Reject) are shown.
export const Pending: Story = {
  args: {
    variant: 'pending',
    item: {
      ...baseReservation,
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
      ...baseReservation,
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
      ...baseReservation,
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
