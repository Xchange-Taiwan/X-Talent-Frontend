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
