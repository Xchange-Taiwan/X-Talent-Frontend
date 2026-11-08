import type { Meta, StoryObj } from '@storybook/nextjs';

import Divider from './Divider';

const meta: Meta<typeof Divider> = {
  title: '業務模組元件/會員驗證(Auth)/Divider',
  component: Divider,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Divider>;

export const Default: Story = {
  args: {},
};

export const WithText: Story = {
  args: {
    children: '或使用電子信箱',
  },
};
