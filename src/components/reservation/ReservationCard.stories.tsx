import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import ReservationConversationDialog from '@/components/reservation/ReservationConversationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { mockReservation } from './mocks';
import { ReservationCard } from './ReservationCard';

const meta: Meta<typeof ReservationCard> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationCard',
  component: ReservationCard,
  tags: ['autodocs'],
  args: {
    sourceRole: 'mentor',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['pending', 'upcoming', 'history'],
      description: '卡片的狀態標籤類別變體',
    },
    sourceRole: {
      control: 'select',
      options: ['mentor', 'mentee'],
      description: '當前檢視者角色（導師或學員）',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReservationCard>;

// 1. PENDING State: Card variant is 'pending', awaiting reply. Mentor actions (Accept / Reject) are shown.
export const Pending: Story = {
  args: {
    variant: 'pending',
    sourceRole: 'mentor',
    item: {
      ...mockReservation,
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
    sourceRole: 'mentor',
    item: {
      ...mockReservation,
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
    sourceRole: 'mentor',
    item: {
      ...mockReservation,
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

// 4. System Auto-Cancelled State: Reservation timed out without confirmation 24h before start.
export const SystemAutoCancelled: Story = {
  args: {
    variant: 'history',
    sourceRole: 'mentee',
    item: {
      ...mockReservation,
      dtstart: Math.floor(Date.now() / 1000) - 24 * 3600,
      dtend: Math.floor(Date.now() / 1000) - 23 * 3600,
      cancelledBy: 'SYSTEM',
    },
    actions: (
      <Badge variant="secondary" role="status">
        系統自動取消
      </Badge>
    ),
    footer: (
      <ReservationConversationDialog
        reservation={{
          ...mockReservation,
          cancelledBy: 'SYSTEM',
        }}
        sourceRole="mentee"
      />
    ),
  },
};

// 5. History Completed State: Session successfully finished with full conversation thread.
export const HistoryCompleted: Story = {
  args: {
    variant: 'history',
    sourceRole: 'mentor',
    item: {
      ...mockReservation,
      dtstart: Math.floor(Date.now() / 1000) - 5 * 24 * 3600,
      dtend: Math.floor(Date.now() / 1000) - 5 * 24 * 3600 + 3600,
      messages: [
        ...mockReservation.messages,
        {
          content:
            '王小明你好！很高興收到你的諮詢邀請。期待週三晚上針對你的架構問題進行交流！',
          role: 'MENTOR',
        },
      ],
      mentorMessage: {
        content:
          '王小明你好！很高興收到你的諮詢邀請。期待週三晚上針對你的架構問題進行交流！',
        role: 'MENTOR',
      },
    },
    footer: (
      <ReservationConversationDialog
        reservation={{
          ...mockReservation,
          messages: [
            ...mockReservation.messages,
            {
              content:
                '王小明你好！很高興收到你的諮詢邀請。期待週三晚上針對你的架構問題進行交流！',
              role: 'MENTOR',
            },
          ],
          mentorMessage: {
            content:
              '王小明你好！很高興收到你的諮詢邀請。期待週三晚上針對你的架構問題進行交流！',
            role: 'MENTOR',
          },
        }}
        sourceRole="mentor"
      />
    ),
  },
};
