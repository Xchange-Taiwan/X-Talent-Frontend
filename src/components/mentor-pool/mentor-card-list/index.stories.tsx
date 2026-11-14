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

export const FilteredSkillPrioritized: Story = {
  args: {
    mentors: mockMentors.slice(0, 3),
    activeFilterBadges: [
      {
        key: 'filter_skills',
        name: '技能',
        value: 'Figma',
        label: 'Figma',
      },
      {
        key: 'filter_skills',
        name: '技能',
        value: 'Next.js',
        label: 'Next.js',
      },
    ],
  },
};

export const CodeMappedSkillAndTopicPrioritized: Story = {
  args: {
    mentors: [
      {
        ...mockMentors[0],
        have_topic: ['career_planning', 'resume_review'],
        have_skill: ['ui_ux_design', 'react_nextjs'],
      },
      {
        ...mockMentors[1],
        have_topic: ['mock_interview'],
        have_skill: ['typescript', 'react_nextjs'],
      },
    ],
    activeFilterBadges: [
      {
        key: 'filter_skills',
        name: '技能',
        value: 'react_nextjs',
        label: 'React / Next.js',
      },
    ],
    labelMap: new Map([
      ['career_planning', '職涯規劃與轉職諮詢'],
      ['resume_review', '履歷健檢與優化'],
      ['mock_interview', '模擬面試與回饋'],
      ['ui_ux_design', 'UI / UX 設計'],
      ['react_nextjs', 'React / Next.js'],
      ['typescript', 'TypeScript'],
    ]),
  },
};

export const EmptyList: Story = {
  args: {
    mentors: [],
  },
};
