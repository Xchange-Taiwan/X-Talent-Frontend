import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import PopularPositionChips from './PopularPositionChips';

const meta: Meta<typeof PopularPositionChips> = {
  title: '業務模組元件/導師池(MentorPool)/PopularPositionChips',
  component: PopularPositionChips,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof PopularPositionChips>;

export const DesktopTrimmed: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-[1280px] p-6">
        <Story />
      </div>
    ),
  ],
};

export const NarrowHorizontalScroll: Story = {
  decorators: [
    (Story) => (
      <div className="w-[360px] p-4">
        <Story />
      </div>
    ),
  ],
};
