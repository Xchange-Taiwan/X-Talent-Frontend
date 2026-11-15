import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import {
  authenticatedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';

import { AuthHintGate, AuthHintProvider } from './AuthHintGate';

const meta: Meta<typeof AuthHintGate> = {
  title: '佈局元件/Header/AuthHintGate',
  component: AuthHintGate,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '封裝 ADR-0001 `data-auth-state` pre-hydration 零閃爍 CSS 選擇器與 `AuthHintContext` 狀態決策之共用元件。',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AuthHintGate>;

export const PreHydrationGuestHint: Story = {
  args: {
    when: ['guest'],
    display: 'flex',
    className: 'items-center gap-2',
    children: <span className="text-text-primary">訪客專用動作按鈕</span>,
  },
  decorators: [
    (Story) => (
      <div className="group/auth-state p-4" data-auth-state="guest">
        <AuthHintProvider identity={UNKNOWN_IDENTITY}>
          <Story />
        </AuthHintProvider>
      </div>
    ),
  ],
};

export const PreHydrationMentorHintAsChild: Story = {
  args: {
    when: ['mentor'],
    asChild: true,
    children: <span className="text-text-primary">我的導師頁面</span>,
  },
  decorators: [
    (Story) => (
      <div className="group/auth-state p-4" data-auth-state="mentor">
        <AuthHintProvider identity={UNKNOWN_IDENTITY}>
          <Story />
        </AuthHintProvider>
      </div>
    ),
  ],
};

export const ResolvedConfirmedGuest: Story = {
  args: {
    when: ['guest'],
    children: <span className="text-text-primary">已確認訪客狀態</span>,
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <AuthHintProvider identity={GUEST_IDENTITY}>
          <Story />
        </AuthHintProvider>
      </div>
    ),
  ],
};

export const HiddenWhenRoleMismatch: Story = {
  args: {
    when: ['guest'],
    children: (
      <span className="text-text-primary">已登入會員將不渲染此區塊</span>
    ),
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <AuthHintProvider
          identity={authenticatedIdentity('mentor-123', { isMentor: true })}
        >
          <Story />
        </AuthHintProvider>
      </div>
    ),
  ],
};
