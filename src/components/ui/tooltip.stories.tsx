import type { Meta, StoryObj } from '@storybook/nextjs';
import { Info } from 'lucide-react';
import React from 'react';

import { Button } from './button';
import { Tooltip } from './tooltip';

const meta: Meta<typeof Tooltip> = {
  title: '基礎/原子元件/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const DefaultHover: Story = {
  args: {
    content: '展開評價未公開說明',
    side: 'top',
    align: 'end',
    contentClassName: 'whitespace-nowrap',
    children: (
      <Button type="button" variant="outline" size="sm">
        移入顯示提示
      </Button>
    ),
  },
};

export const ClickToPin: Story = {
  args: {
    content: '公開評價將以遮罩姓名顯示（例如：王＊明），不會公開您的完整姓名。',
    side: 'top',
    align: 'center',
    pinOnClick: true,
    contentClassName: 'w-60',
    children: (
      <button
        type="button"
        aria-label="姓名遮罩說明"
        className="text-text-secondary hover:bg-background-bottom hover:text-text-primary inline-flex size-7 items-center justify-center rounded-sm"
      >
        <Info className="size-4" aria-hidden="true" />
      </button>
    ),
  },
};
