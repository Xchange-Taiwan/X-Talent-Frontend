import type { Meta, StoryObj } from '@storybook/nextjs';

import { SIGNIN_HREF, SIGNUP_HREF } from '@/lib/routes';

import AuthLink from './AuthLink';

const meta: Meta<typeof AuthLink> = {
  title: '業務模組元件/會員驗證(Auth)/AuthLink',
  component: AuthLink,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AuthLink>;

export const SignUpLink: Story = {
  args: {
    prefixText: '還不是會員?',
    text: '註冊 X-Talent',
    href: SIGNUP_HREF,
  },
};

export const SignInLink: Story = {
  args: {
    prefixText: '已經有帳號了?',
    text: '登入 X-Talent',
    href: SIGNIN_HREF,
  },
};
