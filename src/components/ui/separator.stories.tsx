import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Separator } from './separator';

const meta: Meta<typeof Separator> = {
  title: 'Components/UI/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'The orientation of the separator',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

// 1. Horizontal Demo
export const Horizontal: Story = {
  render: (args) => (
    <div className="max-w-md">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">X-Talent UI</h4>
        <p className="text-sm text-muted-foreground">
          為 Xchange 建立的高品質前端元件庫。
        </p>
      </div>
      <Separator className="my-4" {...args} orientation="horizontal" />
      <div className="flex h-5 items-center space-x-4 text-sm">
        <div>React</div>
        <div>TypeScript</div>
        <div>Tailwind CSS</div>
      </div>
    </div>
  ),
};

// 2. Vertical Demo
export const Vertical: Story = {
  render: (args) => (
    <div className="flex h-5 items-center space-x-4 text-sm">
      <span>設計圖 (UI)</span>
      <Separator {...args} orientation="vertical" />
      <span>前端開發 (FE)</span>
      <Separator {...args} orientation="vertical" />
      <span>後端開發 (BE)</span>
    </div>
  ),
};
