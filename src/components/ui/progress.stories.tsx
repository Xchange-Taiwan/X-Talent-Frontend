import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Progress } from './progress';

const meta: Meta<typeof Progress> = {
  title: 'Components/UI/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'number', min: 0, max: 100 },
      description: 'The completion value of the progress bar',
    },
  },
  args: {
    value: 60,
  },
};

export default meta;
type Story = StoryObj<typeof Progress>;

// 1. Basic Interactive Demo
export const Default: Story = {
  args: {
    value: 33,
  },
};

// 2. Comparison of Values
export const Comparisons: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">進度：0%</span>
        <Progress value={0} />
      </div>
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">進度：50%</span>
        <Progress value={50} />
      </div>
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">進度：100%</span>
        <Progress value={100} />
      </div>
    </div>
  ),
};
