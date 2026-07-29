import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Components/UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

// 1. Basic Shape
export const Default: Story = {
  render: () => <Skeleton className="h-4 w-[250px]" />,
};

// 2. Profile Card Loading Template
export const LoadingCard: Story = {
  render: () => (
    <div className="flex max-w-sm items-center space-x-4 rounded-lg border bg-background-white p-4">
      <Skeleton className="size-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[150px]" />
      </div>
    </div>
  ),
};
