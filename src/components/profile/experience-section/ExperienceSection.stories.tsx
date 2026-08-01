import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import {
  EducationSection,
  ExperienceSection,
  WorkExperienceSection,
} from './ExperienceSection';

const meta: Meta<typeof ExperienceSection> = {
  title: '業務模組元件/個人檔案(Profile)/ExperienceSection/ExperienceSection',
  component: ExperienceSection,
  tags: ['autodocs'],
  args: {
    items: [],
  },
};

export default meta;

type Story = StoryObj<typeof ExperienceSection>;

// ==========================================
// 1. Generic ExperienceSection Stories
// ==========================================

export const DefaultEmpty: Story = {
  args: {
    items: [],
  },
};

export const DefaultFilled: Story = {
  args: {
    items: [
      {
        title: '資深前端工程師 (Senior Frontend Engineer)',
        subtitle: '科技股份有限公司 (Tech Co., Ltd.)',
        startDate: '2023',
        endDate: '至今',
        description:
          '負責開發與維護公司核心 React/Next.js 前端應用，並主導團隊前端架構優化與測試覆蓋。',
      },
      {
        title: '資訊工程學系 (Computer Science & Engineering)',
        subtitle: '國立臺灣大學',
        startDate: '2019',
        endDate: '2023',
        description: '主修計算機科學、演算法與軟體工程。',
      },
    ],
  },
};

// ==========================================
// 2. WorkExperienceSection Stories
// ==========================================

export const WorkSectionEmpty: StoryObj<typeof WorkExperienceSection> = {
  render: () => <WorkExperienceSection workExperiences={[]} />,
};

export const WorkSectionFilled: StoryObj<typeof WorkExperienceSection> = {
  render: () => (
    <WorkExperienceSection
      workExperiences={[
        {
          job: '技術主管 (Tech Lead)',
          company: '跨國電商平台 (E-Commerce Corp)',
          job_period_start: '2022',
          job_period_end: '至今',
          industry: 'Software',
          job_location: 'TWN',
          description:
            '率領 6 人研發小組，重構核心結帳系統，效能提升 35%，並降低錯誤率 50%。',
          is_primary: true,
        },
        {
          job: '前端工程師 (Frontend Engineer)',
          company: '新創社交媒體公司 (Social Co.)',
          job_period_start: '2020',
          job_period_end: '2022',
          industry: 'Software',
          job_location: 'TWN',
          description:
            '使用 React Native 打造多平台行動應用，並維護 Next.js 形象網頁。',
          is_primary: false,
        },
      ]}
    />
  ),
};

// ==========================================
// 3. EducationSection Stories
// ==========================================

export const EducationSectionEmpty: StoryObj<typeof EducationSection> = {
  render: () => <EducationSection educations={[]} />,
};

export const EducationSectionFilled: StoryObj<typeof EducationSection> = {
  render: () => (
    <EducationSection
      educations={[
        {
          subject: '多媒體工程研究所 (Institute of Multimedia Engineering)',
          school: '國立交通大學',
          education_period_start: '2021',
          education_period_end: '2023',
        },
        {
          subject: '資訊管理學系 (Information Management)',
          school: '國立臺灣大學',
          education_period_start: '2017',
          education_period_end: '2021',
        },
      ]}
    />
  ),
};
