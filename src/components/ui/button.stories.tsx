import type { Meta, StoryObj } from '@storybook/nextjs';
import { Loader2, Mail, Plus } from 'lucide-react';
import React from 'react';

import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'Components/UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
      ],
      description: 'The visual style variant of the button',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'The size of the button',
    },
    shape: {
      control: 'select',
      options: ['default', 'pill'],
      description: 'The shape / border-radius of the button',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    asChild: {
      control: 'boolean',
      description:
        'Change the default rendered element to the one passed as a child',
    },
  },
  args: {
    variant: 'default',
    size: 'default',
    shape: 'default',
    disabled: false,
    children: '預約導師諮詢',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// 1. Basic Interactive Demo
export const Default: Story = {
  args: {
    children: '預約諮詢 (Book Session)',
  },
};

// 2. All Variants Comparison
export const AllVariants: Story = {
  render: (args: React.ComponentProps<typeof Button>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} variant="default">
        預約諮詢
      </Button>
      <Button {...args} variant="secondary">
        稍後再說
      </Button>
      <Button {...args} variant="outline">
        返回上頁
      </Button>
      <Button {...args} variant="destructive">
        取消預約
      </Button>
      <Button {...args} variant="ghost">
        略過設定
      </Button>
      <Button {...args} variant="link">
        查看更多
      </Button>
    </div>
  ),
};

// 3. All Sizes Comparison
export const AllSizes: Story = {
  render: (args: React.ComponentProps<typeof Button>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} size="sm">
        小尺寸 (sm)
      </Button>
      <Button {...args} size="default">
        預設尺寸 (default)
      </Button>
      <Button {...args} size="lg">
        大尺寸 (lg)
      </Button>
      <Button {...args} size="icon" aria-label="Add icon">
        <Plus className="size-4" />
      </Button>
    </div>
  ),
};

// 4. All Shapes Comparison
export const AllShapes: Story = {
  render: (args: React.ComponentProps<typeof Button>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} shape="default">
        預設直角
      </Button>
      <Button {...args} shape="pill">
        圓角藥丸 (Pill)
      </Button>
    </div>
  ),
};

// 5. Disabled State
export const Disabled: Story = {
  render: (args: React.ComponentProps<typeof Button>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} disabled variant="default">
        預約諮詢 (禁用)
      </Button>
      <Button {...args} disabled variant="secondary">
        稍後再說 (禁用)
      </Button>
      <Button {...args} disabled variant="outline">
        返回上頁 (禁用)
      </Button>
      <Button {...args} disabled variant="destructive">
        取消預約 (禁用)
      </Button>
      <Button {...args} disabled variant="ghost">
        略過 (禁用)
      </Button>
      <Button {...args} disabled variant="link">
        查看 (禁用)
      </Button>
    </div>
  ),
};

// 6. Loading State
export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <Loader2 className="mr-2 size-4 animate-spin" />
        請稍候...
      </>
    ),
  },
};

// 7. Icon Combinations
export const WithIcon: Story = {
  render: (args: React.ComponentProps<typeof Button>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} variant="default">
        <Mail className="mr-2 size-4" />
        聯絡導師 (Contact)
      </Button>
      <Button {...args} variant="outline">
        <Plus className="mr-2 size-4" />
        申請加入導師庫
      </Button>
    </div>
  ),
};
