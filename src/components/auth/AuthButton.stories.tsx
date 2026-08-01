import type { Meta, StoryObj } from '@storybook/nextjs';

import AuthButton from './AuthButton';

const meta: Meta<typeof AuthButton> = {
  title: '業務模組元件/會員驗證(Auth)/AuthButton',
  component: AuthButton,
  tags: ['autodocs'],
  argTypes: {
    isSubmitting: {
      control: 'boolean',
      description: '表單是否正在提交中',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AuthButton>;

export const Default: Story = {
  args: {
    isSubmitting: false,
    children: '登入',
  },
};

export const Submitting: Story = {
  args: {
    isSubmitting: true,
    children: '登入',
  },
};
