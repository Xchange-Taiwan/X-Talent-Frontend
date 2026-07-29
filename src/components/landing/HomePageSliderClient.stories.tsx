import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { HomePageSliderClient } from './HomePageSliderClient';

const meta: Meta<typeof HomePageSliderClient> = {
  title: 'Components/Landing/HomePageSliderClient',
  component: HomePageSliderClient,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof HomePageSliderClient>;

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-[1200px] rounded-xl bg-background-bottom-secondary p-4">
      <HomePageSliderClient />
    </div>
  ),
};
