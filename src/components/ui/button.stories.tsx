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
    children: 'Button Text',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// 1. Basic Interactive Demo
export const Default: Story = {
  args: {
    children: 'Default Button',
  },
};

// 2. All Variants Comparison
export const AllVariants: Story = {
  render: (args: React.ComponentProps<typeof Button>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} variant="default">
        Default
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="outline">
        Outline
      </Button>
      <Button {...args} variant="destructive">
        Destructive
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="link">
        Link
      </Button>
    </div>
  ),
};

// 3. All Sizes Comparison
export const AllSizes: Story = {
  render: (args: React.ComponentProps<typeof Button>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} size="sm">
        Small (sm)
      </Button>
      <Button {...args} size="default">
        Default
      </Button>
      <Button {...args} size="lg">
        Large (lg)
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
        Default Shape
      </Button>
      <Button {...args} shape="pill">
        Pill Shape
      </Button>
    </div>
  ),
};

// 5. Disabled State
export const Disabled: Story = {
  render: (args: React.ComponentProps<typeof Button>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} disabled variant="default">
        Default Disabled
      </Button>
      <Button {...args} disabled variant="secondary">
        Secondary Disabled
      </Button>
      <Button {...args} disabled variant="outline">
        Outline Disabled
      </Button>
      <Button {...args} disabled variant="destructive">
        Destructive Disabled
      </Button>
      <Button {...args} disabled variant="ghost">
        Ghost Disabled
      </Button>
      <Button {...args} disabled variant="link">
        Link Disabled
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
        使用信箱登入
      </Button>
      <Button {...args} variant="outline">
        <Plus className="mr-2 size-4" />
        新增導師
      </Button>
    </div>
  ),
};
