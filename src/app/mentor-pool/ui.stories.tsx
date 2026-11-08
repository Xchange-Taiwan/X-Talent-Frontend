import type { Meta, StoryObj } from '@storybook/nextjs';

import { REAL_FILTER_OPTIONS } from '@/components/filter/__mocks__/filterMockData';
import { mockMentors } from '@/components/mentor-pool/__mocks__/mentors.mock';

import MentorPoolUI from './ui';

const meta: Meta<typeof MentorPoolUI> = {
  title: '業務模組元件/導師池(MentorPool)/MentorPoolUI',
  component: MentorPoolUI,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
    },
  },
  args: {
    mentors: mockMentors,
    mentorCount: mockMentors.length,
    isLoading: false,
    isReplacing: false,
    listStatus: 'success',
    selectedFilters: {},
    filterOptions: REAL_FILTER_OPTIONS,
    onFilterChange: () => {},
    onRemoveFilter: () => {},
    onClearAll: () => {},
    onScrollToBottom: async () => {},
    onRetry: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof MentorPoolUI>;

export const DefaultSuccess: Story = {
  args: {
    mentors: mockMentors,
    mentorCount: mockMentors.length,
    listStatus: 'success',
  },
};

export const WithActiveFilterBadges: Story = {
  args: {
    mentors: mockMentors.slice(0, 3),
    mentorCount: 3,
    listStatus: 'success',
    selectedFilters: {
      filter_skills: { name: '技能', value: 'react_nextjs' },
      filter_industries: { name: '產業', value: 'software_internet' },
    },
    activeFilterBadges: [
      {
        key: 'filter_skills',
        name: '技能',
        value: 'react_nextjs',
        label: 'React / Next.js',
      },
      {
        key: 'filter_industries',
        name: '產業',
        value: 'software_internet',
        label: '網際網路 / 軟體',
      },
    ],
  },
};

export const ReplacingOverlay: Story = {
  args: {
    mentors: mockMentors.slice(0, 3),
    mentorCount: 3,
    isReplacing: true,
    listStatus: 'success',
  },
};

export const LoadingMoreState: Story = {
  args: {
    mentors: mockMentors,
    mentorCount: mockMentors.length,
    isLoading: true,
    isReplacing: false,
    listStatus: 'success',
  },
};

export const LoadingState: Story = {
  args: {
    mentors: [],
    mentorCount: 0,
    isLoading: true,
    listStatus: 'loading',
  },
};

export const EmptyNoResults: Story = {
  args: {
    mentors: [],
    mentorCount: 0,
    listStatus: 'empty',
    selectedFilters: {
      filter_skills: { name: '技能', value: 'react_nextjs' },
    },
    activeFilterBadges: [
      {
        key: 'filter_skills',
        name: '技能',
        value: 'react_nextjs',
        label: 'React / Next.js',
      },
    ],
  },
};

export const ErrorRetryState: Story = {
  args: {
    mentors: [],
    mentorCount: 0,
    listStatus: 'error',
  },
};
