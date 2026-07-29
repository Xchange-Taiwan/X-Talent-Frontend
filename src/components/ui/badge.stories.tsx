import type { Meta, StoryObj } from '@storybook/nextjs';
import { X } from 'lucide-react';
import React from 'react';

import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'filter'],
      description: 'The visual style variant of the badge',
    },
  },
  args: {
    variant: 'default',
    children: 'Badge',
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

// 1. Basic Interactive Demo
export const Default: Story = {
  args: {
    children: 'Default Badge',
  },
};

// 2. All Variants Comparison
export const AllVariants: Story = {
  render: (args: React.ComponentProps<typeof Badge>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge {...args} variant="default">
        Default
      </Badge>
      <Badge {...args} variant="secondary">
        Secondary
      </Badge>
      <Badge {...args} variant="outline">
        Outline
      </Badge>
      <Badge {...args} variant="destructive">
        Destructive
      </Badge>
      <Badge {...args} variant="filter">
        <span>Filter Badge</span>
        <X className="size-3.5 cursor-pointer text-destructive-foreground hover:text-destructive" />
      </Badge>
    </div>
  ),
};

// 3. Different Content Contexts
export const ContentTypes: Story = {
  render: (args: React.ComponentProps<typeof Badge>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge {...args} variant="default">
        New
      </Badge>
      <Badge {...args} variant="secondary">
        Pending (5)
      </Badge>
      <Badge {...args} variant="outline">
        Design Pattern
      </Badge>
      <Badge {...args} variant="destructive">
        Expired
      </Badge>
    </div>
  ),
};
