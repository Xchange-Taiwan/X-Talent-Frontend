import type { Meta, StoryObj } from '@storybook/nextjs';

import AuthTitle from './AuthTitle';

const meta: Meta<typeof AuthTitle> = {
  title: '業務模組元件/會員驗證(Auth)/AuthTitle',
  component: AuthTitle,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AuthTitle>;

export const SignInTitle: Story = {
  args: {
    children: '登入 X-Talent',
  },
};

export const SignUpTitle: Story = {
  args: {
    children: '註冊 X-Talent',
  },
};
