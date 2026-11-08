import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { mockReservation } from './mocks';
import { ReservationMessagePreview } from './ReservationMessagePreview';

const meta: Meta<typeof ReservationMessagePreview> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationMessagePreview',
  component: ReservationMessagePreview,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background-white max-w-lg rounded-xl border p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    sourceRole: 'mentor',
    variant: 'card',
    reservation: {
      ...mockReservation,
      messages: [
        ...mockReservation.messages,
        {
          content:
            '王小明你好！很高興收到你的諮詢邀請。期待週三晚上與你深入討論架構設計與面試準備！',
          role: 'MENTOR',
        },
      ],
      mentorMessage: {
        content:
          '王小明你好！很高興收到你的諮詢邀請。期待週三晚上與你深入討論架構設計與面試準備！',
        role: 'MENTOR',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReservationMessagePreview>;

export const CardVariantWithBothMessages: Story = {
  args: {
    variant: 'card',
  },
};

export const DialogVariantWithBothMessages: Story = {
  args: {
    variant: 'dialog',
  },
};

export const MenteeMessageOnly: Story = {
  args: {
    variant: 'card',
    reservation: mockReservation,
  },
};
