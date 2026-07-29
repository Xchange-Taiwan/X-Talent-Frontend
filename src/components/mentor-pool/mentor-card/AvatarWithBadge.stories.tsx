import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import defaultAvatar from '@/assets/default-avatar.png';

import { AvatarWithBadge } from './AvatarWithBadge';

const meta: Meta<typeof AvatarWithBadge> = {
  title: 'Components/MentorPool/AvatarWithBadge',
  component: AvatarWithBadge,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[413px] overflow-hidden rounded-lg border border-background-border">
        <Story />
      </div>
    ),
  ],
  args: {
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    years: 'THREE_TO_FIVE',
    name: '陳怡君 (Jane Chen)',
    priority: false,
  },
  argTypes: {
    years: {
      control: 'select',
      options: [
        'BELOW_ONE_YEAR',
        'ONE_TO_THREE',
        'THREE_TO_FIVE',
        'FIVE_TO_TEN',
        'OVER_TEN_YEAR',
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof AvatarWithBadge>;

export const Default: Story = {
  args: {
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    years: 'THREE_TO_FIVE',
    name: '陳怡君 (Jane Chen)',
  },
};

export const LocalDefaultAvatar: Story = {
  args: {
    avatar: defaultAvatar,
    years: 'FIVE_TO_TEN',
    name: '王小明 (John Wang)',
  },
};

export const OverTenYears: Story = {
  args: {
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    years: 'OVER_TEN_YEAR',
    name: '林建宏 (Alex Lin)',
  },
};
