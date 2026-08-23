import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { HomePageSliderClient } from './HomePageSliderClient';

const meta: Meta<typeof HomePageSliderClient> = {
  title: '業務模組元件/首頁(Landing)/HomePageSliderClient',
  component: HomePageSliderClient,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof HomePageSliderClient>;

export const Default: Story = {
  render: () => (
    <div className="bg-background-bottom-secondary w-full max-w-[1200px] rounded-xl p-4">
      <HomePageSliderClient />
    </div>
  ),
};
