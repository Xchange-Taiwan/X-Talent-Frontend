import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Checkbox } from './checkbox';
import { Label } from './label';

const meta: Meta<typeof Checkbox> = {
  title: '基礎/原子元件/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: '核取方塊是否已被禁用',
    },
    checked: {
      control: 'boolean',
      description: '核取方塊是否已被勾選',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" {...args} />
      <Label htmlFor="terms">我同意服務條款與隱私權政策</Label>
    </div>
  ),
};

// 2. Disabled Checkbox
export const Disabled: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center space-x-2">
        <Checkbox id="terms-disabled" {...args} disabled />
        <Label htmlFor="terms-disabled">未勾選且禁用</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="terms-disabled-checked"
          {...args}
          disabled
          defaultChecked
        />
        <Label htmlFor="terms-disabled-checked">已勾選且禁用</Label>
      </div>
    </div>
  ),
};
