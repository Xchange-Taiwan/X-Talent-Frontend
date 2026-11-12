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
    content: '顯示時不會完整公開姓名與個人資料',
    side: 'right',
    align: 'center',
    pinOnClick: true,
    contentClassName: 'w-max max-w-60 px-2.5 py-1.5',
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
