import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockMentors } from '../__mocks__/mentors.mock';
import { MentorCardList } from './index';

const meta: Meta<typeof MentorCardList> = {
  title: '業務模組元件/導師池(MentorPool)/MentorCardList',
  component: MentorCardList,
  tags: ['autodocs'],
  args: {
    mentors: mockMentors,
    onScrollToBottom: async () => {
      console.log('onScrollToBottom called');
    },
  },
};

export default meta;
type Story = StoryObj<typeof MentorCardList>;

export const Default: Story = {
  args: {
    mentors: mockMentors,
  },
};

export const ShortList: Story = {
  args: {
    mentors: mockMentors.slice(0, 2),
  },
};

export const EmptyList: Story = {
  args: {
    mentors: [],
  },
};
