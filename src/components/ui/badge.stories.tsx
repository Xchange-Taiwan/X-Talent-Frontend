import type { Meta, StoryObj } from '@storybook/nextjs';
import { X } from 'lucide-react';
import React from 'react';

import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: '基礎/原子元件/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'filter'],
      description: '徽章的視覺樣式變體',
    },
  },
  args: {
    variant: 'default',
    children: 'React',
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

// 1. Basic Interactive Demo
export const Default: Story = {
  args: {
    children: '前端工程 (Frontend)',
  },
};

// 2. All Variants Comparison
export const AllVariants: Story = {
  render: (args: React.ComponentProps<typeof Badge>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge {...args} variant="default">
        React
      </Badge>
      <Badge {...args} variant="secondary">
        職涯規劃
      </Badge>
      <Badge {...args} variant="outline">
        TypeScript
      </Badge>
      <Badge {...args} variant="destructive">
        已拒絕
      </Badge>
      <Badge {...args} variant="filter">
        <span>資訊科技</span>
        <X className="text-text-white hover:text-status-error-default size-3.5 cursor-pointer" />
      </Badge>
    </div>
  ),
};

// 3. Different Content Contexts
export const ContentTypes: Story = {
  render: (args: React.ComponentProps<typeof Badge>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge {...args} variant="default">
        全新上線
      </Badge>
      <Badge {...args} variant="secondary">
        待審核 (5)
      </Badge>
      <Badge {...args} variant="outline">
        設計模式
      </Badge>
      <Badge {...args} variant="destructive">
        已過期
      </Badge>
    </div>
  ),
};
