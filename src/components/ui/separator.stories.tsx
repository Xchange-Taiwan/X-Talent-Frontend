import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Separator } from './separator';

const meta: Meta<typeof Separator> = {
  title: '基礎/原子元件/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: '分隔線的方向',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

// 1. Horizontal Demo
export const Horizontal: Story = {
  render: (args) => (
    <div className="max-w-md rounded border bg-background-white p-4">
      <div className="space-y-1">
        <h4 className="text-sm leading-none font-medium">
          林小明 (資深前端工程師)
        </h4>
        <p className="text-xs text-text-tertiary">
          擅長 React、TypeScript 以及大規模前端架構，擁有 8
          年以上開發與團隊帶領經驗。
        </p>
      </div>
      <Separator className="my-4" {...args} orientation="horizontal" />
      <div className="flex h-5 items-center space-x-4 text-xs text-text-secondary">
        <div>諮詢次數：32 次</div>
        <Separator orientation="vertical" />
        <div>綜合評價：4.9 ★</div>
        <Separator orientation="vertical" />
        <div>回應速度：24 小時內</div>
      </div>
    </div>
  ),
};

// 2. Vertical Demo
export const Vertical: Story = {
  render: (args) => (
    <div className="flex h-5 items-center space-x-4 text-sm">
      <span>職涯規劃</span>
      <Separator {...args} orientation="vertical" />
      <span>履歷健檢</span>
      <Separator {...args} orientation="vertical" />
      <span>模擬面試</span>
    </div>
  ),
};
