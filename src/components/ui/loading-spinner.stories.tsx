import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { LoadingSpinner, PageLoading } from './loading-spinner';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Components/UI/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'The size of the loading spinner',
    },
    label: {
      control: 'text',
      description: 'The accessibility label for screen readers',
    },
  },
  args: {
    size: 'md',
    label: '載入中',
  },
};

export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

// 1. Basic Interactive Demo
export const Default: Story = {
  args: {},
};

// 2. All Sizes Comparison
export const AllSizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-1.5">
        <LoadingSpinner {...args} size="sm" />
        <span className="text-xs text-text-tertiary">小 (sm)</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <LoadingSpinner {...args} size="md" />
        <span className="text-xs text-text-tertiary">中 (md)</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <LoadingSpinner {...args} size="lg" />
        <span className="text-xs text-text-tertiary">大 (lg)</span>
      </div>
    </div>
  ),
};

// 3. Full Page Loading State
export const PageLoadingDemo: Story = {
  render: () => <PageLoading />,
};
