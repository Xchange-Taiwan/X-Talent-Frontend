import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import MentorPoolSearchBar from './MentorPoolSearchBar';

const meta: Meta<typeof MentorPoolSearchBar> = {
  title: '業務模組元件/導師池(MentorPool)/MentorPoolSearchBar',
  component: MentorPoolSearchBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <div className="relative h-[280px] w-full">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MentorPoolSearchBar>;

export const Default: Story = {};

export const WithPrefilledQuery: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/mentor-pool',
        query: {
          q: '前端工程師',
        },
      },
    },
  },
};
