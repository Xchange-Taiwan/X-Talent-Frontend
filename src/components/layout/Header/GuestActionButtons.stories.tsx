import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { buildDesktopGuestAuth } from '@/hooks/layout/useHeaderNavigation';
import { GUEST_IDENTITY, UNKNOWN_IDENTITY } from '@/test/mocks/identity';

import { AuthHintProvider } from './AuthHintGate';
import { GuestActionButtons } from './GuestActionButtons';

const meta: Meta<typeof GuestActionButtons> = {
  title: '佈局元件/Header/GuestActionButtons',
  component: GuestActionButtons,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '未登入訪客於桌機版 Header 顯示之「註冊 / 登入」行動呼籲按鈕，透過 `<AuthHintGate>` 封裝 ADR-0001 預渲染狀態，並附帶 GA4 事件追蹤屬性。',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-background-white flex items-center gap-3 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GuestActionButtons>;

export const ConfirmedGuest: Story = {
  args: {
    identity: GUEST_IDENTITY,
  },
};

export const UnknownPreHydrationGuest: Story = {
  args: {
    identity: UNKNOWN_IDENTITY,
  },
  decorators: [
    (Story) => (
      <div className="group/auth-state" data-auth-state="guest">
        <Story />
      </div>
    ),
  ],
};

export const ProvidedViaAuthHintContext: Story = {
  decorators: [
    (Story) => (
      <AuthHintProvider identity={GUEST_IDENTITY}>
        <Story />
      </AuthHintProvider>
    ),
  ],
};

const signInActiveAuth = buildDesktopGuestAuth('/auth/signin');

export const SignInActiveRoute: Story = {
  args: {
    identity: GUEST_IDENTITY,
    signup: signInActiveAuth.signup,
    signin: signInActiveAuth.signin,
  },
};

export const HiddenForConfirmedMember: Story = {
  args: {
    identity: {
      state: 'confirmed-member',
      userId: 'user-123',
      avatar: undefined,
      isMentor: false,
    },
  },
};
