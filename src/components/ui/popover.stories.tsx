import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const meta: Meta<typeof Popover> = {
  title: '基礎/原子元件/Popover',
  component: Popover,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Popover>;

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="outline">聯絡資訊</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="leading-none font-medium">
              林小明 (資深前端工程師)
            </h4>
            <p className="font-mono text-xs text-text-tertiary">
              xiaoming.lin@xchange.tw
            </p>
          </div>
          <div className="border-t pt-2">
            <p className="text-sm">歡迎隨時透過電子信箱與導師聯絡！</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
