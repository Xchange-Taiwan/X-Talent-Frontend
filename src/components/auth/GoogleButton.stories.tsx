import type { Meta, StoryObj } from '@storybook/nextjs';

import GoogleButton from './GoogleButton';

const meta: Meta<typeof GoogleButton> = {
  title: '業務模組元件/會員驗證(Auth)/GoogleButton',
  component: GoogleButton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GoogleButton>;

export const SignInButton: Story = {
  args: {
    isSubmitting: false,
    isSignIn: true,
    label: '使用 Google 帳號登入',
  },
};

export const SignUpButton: Story = {
  args: {
    isSubmitting: false,
    isSignIn: false,
    label: '使用 Google 帳號註冊',
  },
};

export const Submitting: Story = {
  args: {
    isSubmitting: true,
    isSignIn: true,
    label: '使用 Google 帳號登入',
  },
};
