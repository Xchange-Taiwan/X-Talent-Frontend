import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import EmailVerifiedFailedIconUrl from '@/assets/auth/email-verified-failed-icon.svg';
import EmailVerifiedIconUrl from '@/assets/auth/email-verified-icon.svg';
import EmailVerifyIconUrl from '@/assets/auth/email-verify-icon.svg';
import { Button } from '@/components/ui/button';

import AuthMessageCard from './AuthMessageCard';

const meta: Meta<typeof AuthMessageCard> = {
  title: '業務模組元件/會員驗證(Auth)/AuthMessageCard',
  component: AuthMessageCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AuthMessageCard>;

export const Default: Story = {
  args: {
    icon: '/logo.svg',
    iconAlt: 'X-Talent Logo',
    title: '歡迎加入 X-Talent',
    children: (
      <div className="text-text-secondary text-center">
        <p className="mb-4">我們已向您的電子信箱發送了一封驗證信。</p>
        <p>請點擊信中的連結啟用您的帳號，開啟您的專業諮詢之旅！</p>
      </div>
    ),
  },
};

export const EmailNotificationSent: Story = {
  args: {
    icon: EmailVerifyIconUrl.src ?? EmailVerifyIconUrl,
    iconAlt: 'Verify Email',
    title: '驗證信箱',
    children: (
      <>
        <p className="text-text-secondary">
          已傳送一封驗證信，點選連結以完成帳號註冊。
        </p>
        <Button shape="pill" className="min-w-[135px] px-6">
          回首頁
        </Button>
      </>
    ),
  },
};

export const VerificationSuccess: Story = {
  args: {
    icon: EmailVerifiedIconUrl.src ?? EmailVerifiedIconUrl,
    iconAlt: 'Verify Email Success',
    title: '驗證成功',
    children: (
      <>
        <p className="text-text-secondary">
          你的帳號已完成註冊。現在可以開始建立你的個人頁面和尋找 Mentors 了！
        </p>
        <Button shape="pill" className="min-w-[135px] px-6">
          設定個人資訊
        </Button>
      </>
    ),
  },
};

export const VerificationFailedOrExpired: Story = {
  args: {
    icon: EmailVerifiedFailedIconUrl.src ?? EmailVerifiedFailedIconUrl,
    iconAlt: 'Verify Email Failed',
    title: '驗證失敗',
    children: (
      <>
        <p className="text-text-secondary">
          您的驗證連結已失效，請重新輸入Email再次驗證
        </p>
        <Button shape="pill" className="min-w-[135px] px-6">
          返回重試
        </Button>
      </>
    ),
  },
};
