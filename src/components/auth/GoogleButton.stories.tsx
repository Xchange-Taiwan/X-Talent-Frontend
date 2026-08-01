import type { Meta, StoryObj } from '@storybook/nextjs';

import GoogleSignUpButton from './GoogleButton';

const meta: Meta<typeof GoogleSignUpButton> = {
  title: '業務模組元件/會員驗證(Auth)/GoogleButton',
  component: GoogleSignUpButton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GoogleSignUpButton>;

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
