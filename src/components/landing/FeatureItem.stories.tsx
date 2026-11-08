import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { featureData } from '@/app/(landing)/data';

import { FeatureItem } from './FeatureItem';

const meta: Meta<typeof FeatureItem> = {
  title: '業務模組元件/首頁(Landing)/FeatureItem',
  component: FeatureItem,
  tags: ['autodocs'],
  args: {
    icon: featureData[0].icon,
    width: featureData[0].width,
    height: featureData[0].height,
    text: featureData[0].text,
  },
};

export default meta;
type Story = StoryObj<typeof FeatureItem>;

export const Default: Story = {};

export const AllFeaturesGrid: Story = {
  render: () => (
    <div className="bg-background-white text-text-primary flex flex-col flex-wrap justify-center p-8 font-bold md:flex-row">
      {featureData.map((item) => (
        <FeatureItem
          key={item.text}
          icon={item.icon}
          width={item.width}
          height={item.height}
          text={item.text}
        />
      ))}
    </div>
  ),
};
