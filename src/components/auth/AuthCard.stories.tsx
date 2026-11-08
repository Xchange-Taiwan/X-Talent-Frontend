import type { Meta, StoryObj } from '@storybook/nextjs';
import Image from 'next/image';
import React from 'react';

import EmailVerifyIconUrl from '@/assets/auth/email-verify-icon.svg';
import AuthButton from '@/components/auth/AuthButton';
import AuthTitle from '@/components/auth/AuthTitle';

import AuthCard from './AuthCard';

const meta: Meta<typeof AuthCard> = {
  title: '業務模組元件/會員驗證(Auth)/AuthCard',
  component: AuthCard,
  tags: ['autodocs'],
  argTypes: {
    showBanner: {
      control: 'boolean',
      description: '是否顯示頂部色塊 Banner',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AuthCard>;

export const DefaultWithoutBanner: Story = {
  args: {
    showBanner: false,
    children: (
      <>
        <AuthTitle>忘記密碼</AuthTitle>
        <p className="text-text-secondary text-center text-sm">
          請輸入您註冊時使用的電子信箱，我們將發送密碼重設連結給您。
        </p>
        <AuthButton isSubmitting={false}>發送重設連結</AuthButton>
      </>
    ),
  },
};

export const WithTopIconBanner: Story = {
  args: {
    showBanner: true,
    bannerContent: (
      <Image
        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2/3 transform"
        src={EmailVerifyIconUrl.src ?? EmailVerifyIconUrl}
        alt="Verify Email"
        width={80}
        height={80}
      />
    ),
    contentClassName: 'text-center',
    children: (
      <>
        <h1 className="text-32 text-text-primary leading-10 font-bold">
          驗證信箱
        </h1>
        <p className="text-text-secondary">
          已傳送一封驗證信，點選連結以完成帳號註冊。
        </p>
      </>
    ),
  },
};

export const CustomWidthAndSpacing: Story = {
  args: {
    showBanner: false,
    className: 'max-w-[480px]',
    contentClassName: 'gap-4 px-8 py-8',
    children: (
      <>
        <AuthTitle>自訂寬距卡片</AuthTitle>
        <p className="text-text-secondary text-center text-sm">
          支援透過 className 與 contentClassName 調整外框最大寬度與內距。
        </p>
      </>
    ),
  },
};
