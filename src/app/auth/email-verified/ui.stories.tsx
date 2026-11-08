import type { Meta, StoryObj } from '@storybook/nextjs';

import EmailVerifiedFailuredIconUrl from '@/assets/auth/email-verified-failed-icon.svg';
import EmailVerifiedIconUrl from '@/assets/auth/email-verified-icon.svg';

import EmailVerifiedPresentation from './ui';

const meta: Meta<typeof EmailVerifiedPresentation> = {
  title: '業務模組元件/會員驗證(Auth)/EmailVerifiedPresentation',
  component: EmailVerifiedPresentation,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof EmailVerifiedPresentation>;

export const VerificationSuccess: Story = {
  args: {
    icon: EmailVerifiedIconUrl.src ?? EmailVerifiedIconUrl,
    title: '驗證成功',
    content:
      '你的帳號已完成註冊。現在可以開始建立你的個人頁面和尋找 Mentors 了！',
    btnContent: '設定個人資訊',
    onSetProfile: () => {},
  },
};

export const VerificationExpiredOrFailed: Story = {
  args: {
    icon: EmailVerifiedFailuredIconUrl.src ?? EmailVerifiedFailuredIconUrl,
    title: '驗證失敗',
    content: '您的驗證連結已失效，請重新輸入Email再次驗證',
    btnContent: '返回重試',
    onSetProfile: () => {},
  },
};
