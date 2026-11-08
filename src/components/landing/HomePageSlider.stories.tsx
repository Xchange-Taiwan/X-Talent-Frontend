import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { HomePageSlider } from './HomePageSlider';

const meta: Meta<typeof HomePageSlider> = {
  title: '業務模組元件/首頁(Landing)/HomePageSlider',
  component: HomePageSlider,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof HomePageSlider>;

export const Default: Story = {
  render: () => (
    <div className="bg-background-bottom-secondary w-full max-w-[1200px] rounded-xl p-4">
      <HomePageSlider />
    </div>
  ),
};
