import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { HomePageSlider } from './HomePageSlider';

const meta: Meta<typeof HomePageSlider> = {
  title: 'Components/Landing/HomePageSlider',
  component: HomePageSlider,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof HomePageSlider>;

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-[1200px] rounded-xl bg-background-bottom-secondary p-4">
      <HomePageSlider />
    </div>
  ),
};
