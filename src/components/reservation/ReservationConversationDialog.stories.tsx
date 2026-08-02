import type { Meta, StoryObj } from '@storybook/nextjs';

import type { Reservation } from '@/types/reservation';

import { mockReservation } from './mocks';
import ReservationConversationDialog from './ReservationConversationDialog';

const meta: Meta<typeof ReservationConversationDialog> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationConversationDialog',
  component: ReservationConversationDialog,
  tags: ['autodocs'],
  argTypes: {
    sourceRole: {
      control: 'select',
      options: ['mentor', 'mentee'],
      description:
        'Which role the current user is browsing as (primarily for analytics context)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReservationConversationDialog>;

// Extend mockReservation with mentor reply to form a complete, realistic conversation
const conversationReservation: Reservation = {
  ...mockReservation,
  messages: [
    {
      content:
        '嗨！我想向您諮詢關於大型 React 專案在 Next.js App Router 架構底下的元件拆分，以及效能瓶頸（RSC vs Client Component）的實戰優化建議。另外也想了解在跨國外商的升遷機制與面試準備重點，謝謝導師！',
      role: 'MENTEE',
    },
    {
      content:
        '王小明你好！很高興收到你的諮詢邀請。這兩個主題都非常實用。建議你在對談前可以先準備一兩個具體遇到的 Bottleneck 案例或程式碼片段，我們當天可以直接針對實際場景進行 Code Review，這樣對你幫助最大。期待週三晚上聊聊！',
      role: 'MENTOR',
    },
  ],
  mentorMessage: {
    content:
      '王小明你好！很高興收到你的諮詢邀請。這兩個主題都非常實用。建議你在對談前可以先準備一兩個具體遇到的 Bottleneck 案例或程式碼片段，我們當天可以直接針對實際場景進行 Code Review，這樣對你幫助最大。期待週三晚上聊聊！',
    role: 'MENTOR',
  },
};

// 1. Default (Mentor View)
export const Default: Story = {
  args: {
    reservation: conversationReservation,
    sourceRole: 'mentor',
  },
};

// 2. Mentee View
export const MenteeView: Story = {
  args: {
    reservation: conversationReservation,
    sourceRole: 'mentee',
  },
};

// 3. Multi-turn Chat Conversation: Showcases bubble groupings with consecutive messages from the same role.
export const MultiTurnConversation: Story = {
  args: {
    reservation: {
      ...mockReservation,
      messages: [
        {
          content: '導師您好，我想約諮詢前端面試。',
          role: 'MENTEE',
        },
        {
          content: '沒問題，請問你想加強哪一部分？是演算法還是系統設計？',
          role: 'MENTOR',
        },
        {
          content:
            '我想加強系統設計（System Design），尤其是前端大檔案上傳與快取機制。',
          role: 'MENTEE',
        },
        {
          content: '另外，也希望能順便聊聊履歷健檢。',
          role: 'MENTEE',
        },
        {
          content: '好的！這兩個題目都很重要，履歷的部分我會在線上幫你過一次。',
          role: 'MENTOR',
        },
        {
          content: '前端系統設計的部分，我會準備一兩個大型系統架構圖跟你探討。',
          role: 'MENTOR',
        },
        {
          content: '太棒了，謝謝導師！期待當天見。',
          role: 'MENTEE',
        },
      ],
    },
    sourceRole: 'mentor',
  },
};

// 4. Empty Conversation (Fallback text)
export const EmptyConversation: Story = {
  args: {
    reservation: {
      ...mockReservation,
      messages: [],
      menteeMessage: undefined,
      mentorMessage: undefined,
    },
    sourceRole: 'mentor',
  },
};
