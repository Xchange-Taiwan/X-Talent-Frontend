import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Information } from './Information';

const meta: Meta<typeof Information> = {
  title: 'Components/MentorPool/Information',
  component: Information,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[413px] rounded-lg border border-background-border bg-background-white p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    name: '陳怡君 (Jane Chen)',
    job_title: 'Senior UI/UX Designer',
    company: 'Google',
    about:
      '擁有 8 年以上數位產品設計經驗，曾主導多個跨國 B2B 與 B2C 產品的設計與優化。熱衷於使用者研究、資訊架構與互動設計。',
    haveTopicLabels: [
      'UI/UX 設計',
      '使用者研究',
      '產品規劃',
      '職涯諮詢',
      '求職履歷優化',
    ],
  },
};

export default meta;
type Story = StoryObj<typeof Information>;

export const Default: Story = {
  args: {
    name: '陳怡君 (Jane Chen)',
    job_title: 'Senior UI/UX Designer',
    company: 'Google',
    about:
      '擁有 8 年以上數位產品設計經驗，曾主導多個跨國 B2B 與 B2C 產品的設計與優化。熱衷於使用者研究、資訊架構與互動設計。',
    haveTopicLabels: [
      'UI/UX 設計',
      '使用者研究',
      '產品規劃',
      '職涯諮詢',
      '求職履歷優化',
    ],
  },
};

export const ShortAboutAndFewTags: Story = {
  args: {
    name: '王小明 (John Wang)',
    job_title: 'Frontend Engineer',
    company: 'TSMC',
    about: '專注於 React/Next.js 前端開發與效能優化。',
    haveTopicLabels: ['Frontend', 'React', 'TypeScript'],
  },
};

export const LongCompanyAndManyTags: Story = {
  args: {
    name: '林建宏 (Alex Lin)',
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
