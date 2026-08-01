import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

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
      <div className="text-center text-text-secondary">
        <p className="mb-4">我們已向您的電子信箱發送了一封驗證信。</p>
        <p>請點擊信中的連結啟用您的帳號，開啟您的專業諮詢之旅！</p>
      </div>
    ),
  },
};
