import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { mockMentors } from '../__mocks__/mentors.mock';
import { Information } from './Information';

const meta: Meta<typeof Information> = {
  title: '業務模組元件/導師池(MentorPool)/Information',
  component: Information,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="border-background-border bg-background-white w-[413px] rounded-lg border p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    name: mockMentors[0].name,
    job_title: mockMentors[0].job_title,
    company: mockMentors[0].company,
    about: mockMentors[0].about,
    haveTopicLabels: mockMentors[0].have_topic,
    ratingAverage: mockMentors[0].stats?.rating_average ?? null,
    completedMeetingCount:
      mockMentors[0].stats?.completed_meeting_count ?? null,
  },
};

export default meta;
type Story = StoryObj<typeof Information>;

export const Default: Story = {
  args: {
    name: mockMentors[0].name,
    job_title: mockMentors[0].job_title,
    company: mockMentors[0].company,
    about: mockMentors[0].about,
    haveTopicLabels: mockMentors[0].have_topic,
    ratingAverage: 9.8,
    completedMeetingCount: 18,
  },
};

export const CompletedSessionsWithoutRating: Story = {
  args: {
    name: mockMentors[2].name,
    job_title: mockMentors[2].job_title,
    company: mockMentors[2].company,
    about: mockMentors[2].about,
    haveTopicLabels: mockMentors[2].have_topic,
    ratingAverage: null,
    completedMeetingCount: 5,
  },
};

export const NoRatingsAndNoSessions: Story = {
  args: {
    name: mockMentors[3].name,
    job_title: mockMentors[3].job_title,
    company: mockMentors[3].company,
    about: mockMentors[3].about,
    haveTopicLabels: mockMentors[3].have_topic,
    ratingAverage: null,
    completedMeetingCount: 0,
  },
};

export const MobileLongNameTruncation: Story = {
  decorators: [
    (Story) => (
      <div className="border-background-border bg-background-white w-[334px] rounded-lg border p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    name: '張哲瑋 Christopher Alexander Chang-Williams',
    job_title: 'Senior UX Designer',
    company: 'CreativeUX Design Studio',
    about: mockMentors[0].about,
    haveTopicLabels: mockMentors[0].have_topic,
    ratingAverage: 9.8,
    completedMeetingCount: 12,
  },
};

export const ShortAboutAndFewTags: Story = {
  args: {
    name: mockMentors[1].name,
    job_title: mockMentors[1].job_title,
    company: mockMentors[1].company,
    about: '專注於 React/Next.js 前端開發與效能優化。',
    haveTopicLabels: ['Frontend', 'React', 'TypeScript'],
  },
};

export const LongCompanyAndManyTags: Story = {
  args: {
    name: mockMentors[2].name,
    job_title: 'Staff Product Manager & Agile Coach',
    company: 'Taiwan Semiconductor Manufacturing Company (TSMC) Ltd.',
    about:
      '超過 12 年跨國科技大廠專案與產品管理實務，專精於敏捷開發導入、團隊流程重塑、大規模系統規劃與敏捷轉型指導。幫助超過 100 位學員建立核心職場影響力與職涯突破。',
    haveTopicLabels: [
      'Agile PM',
      'Scrum',
      'Product Strategy',
      'System Architecture',
      'Team Leadership',
      'Career Coaching',
      'Cross-functional Alignment',
    ],
  },
};

export const MissingRoleAndShortAbout: Story = {
  args: {
    name: mockMentors[0].name,
    job_title: '',
    company: '',
    about: '單行簡短自介。',
    haveTopicLabels: ['UI/UX 設計', 'Figma', 'Prototyping'],
  },
};
