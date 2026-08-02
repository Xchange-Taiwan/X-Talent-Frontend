import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { RequiredIndicator } from './RequiredIndicator';

const meta: Meta<typeof RequiredIndicator> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/RequiredIndicator',
  component: RequiredIndicator,
  tags: ['autodocs'],
  argTypes: {
    show: {
      control: 'boolean',
      description: '是否顯示必填指示器 (紅色星號)',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
  },
  args: {
    show: true,
  },
};

export default meta;

type Story = StoryObj<typeof RequiredIndicator>;

export const Default: Story = {
  args: {
    show: true,
  },
  render: (args) => (
    <div className="flex items-center gap-2">
      <RequiredIndicator {...args} />
      <span>必填欄位範例</span>
    </div>
  ),
};

export const Hidden: Story = {
  args: {
    show: false,
  },
  render: (args) => (
    <div className="flex items-center gap-2">
      <RequiredIndicator {...args} />
      <span>非必填欄位範例</span>
    </div>
  ),
};
