import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './select';

const meta: Meta<typeof Select> = {
  title: 'Components/UI/Select',
  component: Select,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Select>;

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => (
    <div className="w-[180px]">
      <Select {...args}>
        <SelectTrigger>
          <SelectValue placeholder="選擇主題" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>主題</SelectLabel>
            <SelectItem value="light">淺色模式 (Light)</SelectItem>
            <SelectItem value="dark">深色模式 (Dark)</SelectItem>
            <SelectItem value="system">系統預設 (System)</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
};

// 2. Disabled Select
export const Disabled: Story = {
  render: (args) => (
    <div className="w-[180px]">
      <Select {...args} disabled>
        <SelectTrigger>
          <SelectValue placeholder="選擇城市" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tpe">台北市</SelectItem>
          <SelectItem value="khh">高雄市</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
