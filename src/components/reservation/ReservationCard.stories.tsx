import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import MeetingFeedbackDialog from '@/components/reservation/MeetingFeedbackDialog';
import ReservationConversationDialog from '@/components/reservation/ReservationConversationDialog';
import {
  ReservationFeedbackBlock,
  ReservationFeedbackHeaderToggle,
} from '@/components/reservation/ReservationFeedbackBlock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UNPUBLICIZED_FEEDBACK_NOTICE } from '@/lib/reservation/resolveHistoryFeedbackState';

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
    headerAction: (
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
    headerAction: (
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

// 6. Mentee History - Needs Feedback (#730 Design Hub: top-right 填寫回饋 button)
export const HistoryMenteeNeedsFeedback: Story = {
  args: {
    variant: 'history',
    sourceRole: 'mentee',
    item: {
      ...mockReservation,
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    },
    headerAction: (
      <MeetingFeedbackDialog
        reservation={mockReservation}
        onSubmitFeedback={async () => {}}
      />
    ),
    footer: (
      <ReservationConversationDialog
        reservation={mockReservation}
        sourceRole="mentee"
      />
    ),
  },
};

// 7. Mentee History - Public Rating Submitted (查看回饋 ⌄ collapsible toggle + 編輯)
export const HistoryMenteeRatedPublic: Story = {
  args: {
    variant: 'history',
    sourceRole: 'mentee',
    item: {
      ...mockReservation,
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 10,
          content: '導師給了非常具體的架構重構建議，收穫滿滿！',
          createdAt: 1760000000,
          updatedAt: 1760000000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    },
    headerAction: (
      <ReservationFeedbackHeaderToggle
        action={{ kind: 'feedback-toggle', label: '查看回饋' }}
        isExpanded={true}
        onToggle={() => {}}
      />
    ),
    feedbackContent: (
      <ReservationFeedbackBlock
        model={{
          kind: 'public-rating',
          label: '我的回饋',
          rating: 10,
          content: '導師給了非常具體的架構重構建議，收穫滿滿！',
          canEdit: true,
        }}
        editAction={
          <MeetingFeedbackDialog
            mode="edit"
            reservation={{
              ...mockReservation,
              feedback: {
                meetingHappened: true,
                rating: {
                  rating: 10,
                  content: '導師給了非常具體的架構重構建議，收穫滿滿！',
                  createdAt: 1760000000,
                  updatedAt: 1760000000,
                  authorName: '王＊明',
                  isPublic: true,
                },
                nextStep: null,
              },
            }}
            onUpdateFeedback={async () => {}}
          />
        }
      />
    ),
  },
};

// 8. Mentee History - Unpublicized Rating (#734 warm-yellow 評價未公開 + chevron tooltip + expandable notice + #731 編輯)
export const HistoryMenteeRatedUnpublicized: Story = {
  args: {
    variant: 'history',
    sourceRole: 'mentee',
    item: {
      ...mockReservation,
      feedback: {
        meetingHappened: false,
        rating: {
          rating: 9,
          content: '感謝導師分享。',
          createdAt: 1760000000,
          updatedAt: 1760000000,
          authorName: '王＊明',
          isPublic: false,
        },
        nextStep: null,
      },
    },
    headerAction: (
      <ReservationFeedbackHeaderToggle
        action={{
          kind: 'unpublicized-toggle',
          badgeLabel: '評價未公開',
          expandTooltip: '展開評價未公開說明',
          collapseTooltip: '收合評價未公開說明',
        }}
        isExpanded={true}
        onToggle={() => {}}
      />
    ),
    feedbackContent: (
      <ReservationFeedbackBlock
        model={{
          kind: 'unpublicized',
          rating: 9,
          content: '感謝導師分享。',
          notice: UNPUBLICIZED_FEEDBACK_NOTICE,
          canEdit: true,
        }}
        editAction={
          <MeetingFeedbackDialog
            mode="edit"
            reservation={{
              ...mockReservation,
              feedback: {
                meetingHappened: false,
                rating: {
                  rating: 9,
                  content: '感謝導師分享。',
                  createdAt: 1760000000,
                  updatedAt: 1760000000,
                  authorName: '王＊明',
                  isPublic: false,
                },
                nextStep: null,
              },
            }}
            onUpdateFeedback={async () => {}}
          />
        }
      />
    ),
  },
};

// 9. Mentee History - Meeting Not Happened (未進行)
export const HistoryMenteeNotHappened: Story = {
  args: {
    variant: 'history',
    sourceRole: 'mentee',
    item: {
      ...mockReservation,
      feedback: {
        meetingHappened: false,
        rating: null,
        nextStep: null,
      },
    },
    headerAction: (
      <Badge variant="secondary" role="status">
        未進行
      </Badge>
    ),
  },
};
