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

export const SinglePageFullList: Story = {
  args: {
    mentors: Array.from({ length: 9 }, (_, index) => ({
      ...mockMentors[index % mockMentors.length],
      user_id: index + 1,
      name: `${mockMentors[index % mockMentors.length].name} #${index + 1}`,
    })),
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
