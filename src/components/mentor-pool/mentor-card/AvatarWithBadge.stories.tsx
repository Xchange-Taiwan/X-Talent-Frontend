import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { mockMentors } from '../__mocks__/mentors.mock';
import { AvatarWithBadge } from './AvatarWithBadge';

const meta: Meta<typeof AvatarWithBadge> = {
  title: '業務模組元件/導師池(MentorPool)/AvatarWithBadge',
  component: AvatarWithBadge,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="border-background-border w-[413px] overflow-hidden rounded-lg border">
        <Story />
      </div>
    ),
  ],
  args: {
    avatar: mockMentors[0].avatar,
    years: mockMentors[0].years_of_experience,
    name: mockMentors[0].name,
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
    avatar: mockMentors[0].avatar,
    years: mockMentors[0].years_of_experience,
    name: mockMentors[0].name,
  },
};

export const LocalDefaultAvatar: Story = {
  args: {
    avatar: mockMentors[1].avatar,
    years: mockMentors[1].years_of_experience,
    name: mockMentors[1].name,
  },
};

export const OverTenYears: Story = {
  args: {
    avatar: mockMentors[2].avatar,
    years: mockMentors[2].years_of_experience,
    name: mockMentors[2].name,
  },
};
