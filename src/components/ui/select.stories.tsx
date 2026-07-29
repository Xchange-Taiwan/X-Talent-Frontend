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
          <SelectValue placeholder="選擇年資範圍" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>年資 (Work Span)</SelectLabel>
            <SelectItem value="below-1">1 年以下</SelectItem>
            <SelectItem value="1-3">1~3 年</SelectItem>
            <SelectItem value="3-5">3~5 年</SelectItem>
            <SelectItem value="5-10">5~10 年</SelectItem>
            <SelectItem value="above-10">10 年以上</SelectItem>
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
          <SelectValue placeholder="選擇諮詢狀態" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">待處理 (PENDING)</SelectItem>
          <SelectItem value="accept">已接受 (ACCEPT)</SelectItem>
          <SelectItem value="reject">已拒絕 (REJECT)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
