import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Slider } from './slider';

const meta: Meta<typeof Slider> = {
  title: '基礎/原子元件/Slider',
  component: Slider,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    defaultValue: [50],
    max: 100,
    step: 1,
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {};

export const CustomStepAndRange: Story = {
  args: {
    defaultValue: [2],
    min: 1,
    max: 5,
    step: 0.5,
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: [40],
    disabled: true,
  },
};
